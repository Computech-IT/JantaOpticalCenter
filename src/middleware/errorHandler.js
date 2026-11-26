const env = require("../config/env");

function notFoundHandler(req, res) {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.status(404).send("Not Found");
}

function errorHandler(err, req, res, _next) {
  const status = err.statusCode || err.status || 500;
  const isMulterError = err.name === "MulterError";

  if (isMulterError) {
    return res.status(400).json({ error: err.message });
  }

  if (err.message && err.message.startsWith("CORS policy")) {
    return res.status(403).json({ error: err.message });
  }

  console.error(`[Error] ${req.method} ${req.originalUrl}:`, err);

  res.status(status).json({
    error: env.IS_PROD && status === 500 ? "Internal server error" : err.message || "Server error",
  });
}

module.exports = { notFoundHandler, errorHandler };
