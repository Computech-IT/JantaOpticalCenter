const jwt = require("jsonwebtoken");
const env = require("../config/env");

function parseCustomerCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (part.startsWith("joc_customer_token=")) {
      return decodeURIComponent(part.slice("joc_customer_token=".length));
    }
  }
  return null;
}

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return parseCustomerCookie(req.headers.cookie);
}

function verifyCustomer(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: "Please sign in to your account" });
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (decoded.role !== "customer") {
      return res.status(403).json({ error: "Invalid customer session" });
    }
    req.customer = { id: decoded.id, email: decoded.email, name: decoded.name };
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

function optionalCustomer(req, _res, next) {
  const token = extractToken(req);
  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      if (decoded.role === "customer") {
        req.customer = { id: decoded.id, email: decoded.email, name: decoded.name };
      }
    } catch {}
  }
  next();
}

module.exports = { verifyCustomer, optionalCustomer };
