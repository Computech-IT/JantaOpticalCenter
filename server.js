const env = require("./src/config/env");
const app = require("./src/app");
const db = require("./src/db");
const { runMigrations } = require("./src/db/migrations");

let server;

async function start() {
  try {
    await runMigrations();
    server = app.listen(env.PORT, () => {
      console.log(`[Server] Janta Optical Center running on port ${env.PORT} (${env.NODE_ENV})`);
    });
  } catch (err) {
    console.error("[Server] Failed to start:", err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  } else {
    await db.close();
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
