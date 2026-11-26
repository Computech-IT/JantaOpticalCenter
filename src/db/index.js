const path = require("path");
const fs = require("fs");
const env = require("../config/env");

const isMysql = Boolean(env.DB.HOST);

let pool = null;
let sqliteDb = null;

function initDb() {
  if (isMysql) {
    const mysql = require("mysql2/promise");
    pool = mysql.createPool({
      host: env.DB.HOST,
      port: env.DB.PORT,
      user: env.DB.USER,
      password: env.DB.PASSWORD,
      database: env.DB.NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
    console.log("[DB] MySQL connection pool initialized");
  } else {
    const sqlite3 = require("sqlite3").verbose();
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, "products.db");
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("[DB] SQLite connection error:", err);
      } else {
        sqliteDb.run("PRAGMA journal_mode = WAL;");
        sqliteDb.run("PRAGMA foreign_keys = ON;");
        console.log("[DB] Connected to SQLite (WAL mode)");
      }
    });
  }
}

initDb();

async function query(sql, params = []) {
  if (isMysql) {
    const [rows] = await pool.execute(sql, params);
    return rows;
  }
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function getOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function execute(sql, params = []) {
  if (isMysql) {
    const [result] = await pool.execute(sql, params);
    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows,
    };
  }
  return new Promise((resolve, reject) => {
    sqliteDb.run(sql, params, function (err) {
      if (err) reject(err);
      else
        resolve({
          insertId: this.lastID,
          affectedRows: this.changes,
        });
    });
  });
}

async function healthCheck() {
  try {
    await query("SELECT 1 AS ok");
    return { status: "up", engine: isMysql ? "mysql" : "sqlite" };
  } catch (err) {
    return { status: "down", engine: isMysql ? "mysql" : "sqlite", error: err.message };
  }
}

async function close() {
  if (isMysql && pool) {
    await pool.end();
  } else if (sqliteDb) {
    await new Promise((resolve) => sqliteDb.close(resolve));
  }
}

module.exports = {
  isMysql,
  query,
  getOne,
  execute,
  healthCheck,
  close,
};
