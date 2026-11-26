const env = require("./src/config/env");
const app = require("./src/app");
const db = require("./src/db");
const { runMigrations } = require("./src/db/migrations");

// Start listening immediately so PaaS/Passenger reverse proxies never return 503
const server = app.listen(env.PORT, () => {
  console.log(`[Server] Janta Optical Center running on port ${env.PORT} (${env.NODE_ENV})`);
});

// Run idempotent DB migrations in background without crashing the process
runMigrations().catch((err) => {
  console.error("[DB] Startup migration warning (server still running):", err.message);
});

async function shutdown(signal) {
  console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
