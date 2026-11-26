const jwt = require("jsonwebtoken");
const env = require("../config/env");

function parseCookieToken(cookieHeader) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (part.startsWith("joc_admin_token=")) {
      return decodeURIComponent(part.slice("joc_admin_token=".length));
    }
  }
  return null;
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else {
    token = parseCookieToken(req.headers.cookie);
  }

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    // Reject non-admin or stale pre-upgrade tokens as 401 so the client re-authenticates
    if (decoded.type !== "admin") {
      return res.status(401).json({ error: "Session invalid or outdated. Please sign in again." });
    }
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role || "super_admin",
    };
    req.userId = decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Token invalid or expired" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: Insufficient permissions" });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole };
