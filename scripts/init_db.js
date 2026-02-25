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
    const images = Array.isArray(p.images) ? JSON.stringify(p.images) : JSON.stringify([p.img || '']);
    stmt.run(p.id, p.name, p.price, p.desc || p.description || '', images);
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

  // create admins table
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at TEXT
  )`);

  const bcrypt = require('bcryptjs');
  const defaultUser = 'admin';
  const defaultPass = 'admin123';
  const passHash = bcrypt.hashSync(defaultPass, 10);
  const now = new Date().toISOString();

  // Use REPLACE INTO to ensure the account exists with the correct password every time it runs
  db.run('REPLACE INTO admins (id, username, password_hash, created_at) VALUES (1, ?, ?, ?)', [defaultUser, passHash, now], (err) => {
    if (err) console.error('Error creating admin:', err.message);
    else console.log('Admin account created or refreshed: admin / admin123');
  });

  console.log('Database initialization scheduled.');
});

db.close((err) => {
  if (err) console.error('Error closing database:', err.message);
  else console.log('Database initialization complete and connection closed.');
});
