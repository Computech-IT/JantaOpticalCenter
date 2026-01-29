// Initialize a SQLite database `data/products.db` from public/data/products.json
// Usage: npm install sqlite3 (if not installed), then: node scripts/init_db.js

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const jsonPath = path.join(__dirname, '..', 'public', 'data', 'products.json');
const dbDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dbDir, 'products.db');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const products = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run('DROP TABLE IF EXISTS products');
  db.run(
    `CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT,
      price INTEGER,
      description TEXT,
      img TEXT
    )`
  );

  const stmt = db.prepare('INSERT INTO products (id, name, price, description, img) VALUES (?, ?, ?, ?, ?)');
  products.forEach(p => {
    stmt.run(p.id, p.name, p.price, p.desc || p.description || '', p.img);
  });
  stmt.finalize();
  // create orders table if not exists
  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    items_json TEXT,
    total INTEGER,
    created_at TEXT
  )`);

  console.log('Database initialized at', dbPath);
});

db.close();
