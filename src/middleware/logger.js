const crypto = require("crypto");

function requestLogger(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const start = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    // Log API and health requests as structured JSON; skip noisy static asset hits
    if (!req.originalUrl.startsWith("/api") && req.originalUrl !== "/healthz") return;

    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const entry = {
      timestamp: new Date().toISOString(),
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    };
    if (process.env.NODE_ENV !== "test") {
      console.log(JSON.stringify(entry));
    }
  });

  next();
}

module.exports = { requestLogger };
