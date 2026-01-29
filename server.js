const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Simple request logger to help debug 404s
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

// Try to use sqlite3 if installed to serve products and orders
let db = null;
try {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const dbPath = path.join(__dirname, 'data', 'products.db');
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.warn('SQLite DB not available:', err.message);
    else console.log('Connected to SQLite DB at', dbPath);
  });
} catch (e) {
  console.warn('sqlite3 not installed; API will fall back to JSON');
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Janta Optical backend running' });
});

// Products API - prefer sqlite DB, fallback to JSON file
app.get('/api/products', (req, res) => {
  if (db) {
    db.all('SELECT id, name, price, description as desc, img FROM products', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  } else {
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, 'public', 'data', 'products.json');
    try {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      res.json(JSON.parse(raw));
    } catch (err) {
      res.status(500).json({ error: 'Products not available' });
    }
  }
});

// Get single product
app.get('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  if (db) {
    db.get('SELECT id, name, price, description as desc, img FROM products WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    });
  } else {
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, 'public', 'data', 'products.json');
    try {
      const raw = fs.readFileSync(jsonPath, 'utf8');
      const products = JSON.parse(raw);
      const product = products.find(p => p.id === id);
      if (!product) return res.status(404).json({ error: 'Not found' });
      res.json(product);
    } catch (err) {
      res.status(500).json({ error: 'Products not available' });
    }
  }
});

// Orders API - store into SQLite if possible, else return success and echo
app.post('/api/orders', (req, res) => {
  const { name, phone, address, notes, items, total } = req.body;
  if (!name || !phone || !address || !items) return res.status(400).json({ error: 'Missing fields' });

  if (db) {
    const stmt = db.prepare('INSERT INTO orders (customer_name, phone, address, notes, items_json, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const itemsJson = JSON.stringify(items);
    const created = new Date().toISOString();
    stmt.run(name, phone, address, notes || '', itemsJson, total || 0, created, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, orderId: this.lastID });
    });
    stmt.finalize();
  } else {
    // fallback: accept and echo
    res.json({ success: true, order: { name, phone, address, notes, items, total } });
  }
});

// Serve frontend AFTER API routes so API endpoints take priority
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
