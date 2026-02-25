const express = require('express');
const cors = require('cors');
require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'janta_optical_super_secret_key_123!';

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Simple request logger to help debug 404s
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

// Database Connection (MySQL for Prod, SQLite for Dev)
let db = null;
const isProd = process.env.DB_HOST ? true : false;

if (isProd) {
  try {
    const mysql = require('mysql2');
    db = mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    db.connect(err => {
      if (err) {
        console.error('Failed to connect to MySQL:', err.message);
        process.exit(1);
      }
      console.log('Connected to MySQL Production Database');
    });

    // Add a simple compatibility layer for SQLite-style calls
    const originalAll = db.all;
    db.all = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      db.query(sql, params, (err, rows) => cb(err, rows));
    };
    db.get = (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      db.query(sql, params, (err, rows) => cb(err, rows ? rows[0] : null));
    };
    db.run = function (sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      db.query(sql, params, function (err, result) {
        if (cb) cb.call({ lastID: result ? result.insertId : null, changes: result ? result.affectedRows : 0 }, err);
      });
    };
    db.prepare = (sql) => {
      return {
        run: (params, cb) => db.run(sql, params, cb),
        finalize: () => { } // No-op for MySQL
      };
    };
  } catch (e) {
    console.warn('mysql2 not installed; Please run npm install mysql2');
  }
} else {
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
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Janta Optical backend running' });
});

// Products API - prefer sqlite DB, fallback to JSON file
app.get('/api/products', (req, res) => {
  if (db) {
    db.all('SELECT id, name, price, description as desc, img FROM products', (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      // Parse images safely
      const processed = rows.map(p => {
        let images = [];
        try {
          images = JSON.parse(p.img);
          if (!Array.isArray(images)) images = [p.img];
        } catch (e) {
          images = [p.img];
        }
        return { ...p, images };
      });
      res.json(processed);
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

      let images = [];
      try {
        images = JSON.parse(row.img);
        if (!Array.isArray(images)) images = [row.img];
      } catch (e) {
        images = [row.img];
      }
      res.json({ ...row, images });
    });
  } else {
    // ... fallback remains same
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

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'No token provided' });

  jwt.verify(token.split(' ')[1], JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    req.userId = decoded.id;
    next();
  });
};

// Admin Login Route
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!db) return res.status(500).json({ error: 'Database not configured' });

  db.get('SELECT * FROM admins WHERE username = ?', [username], (err, admin) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!admin) return res.status(401).json({ error: 'Invalid username or password' });

    const passwordIsValid = bcrypt.compareSync(password, admin.password_hash);
    if (!passwordIsValid) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, username: admin.username });
  });
});

// Admin Product CRUD APIs
app.post('/api/admin/products', verifyToken, (req, res) => {
  const { name, price, description, img } = req.body;
  if (!name || price == null) return res.status(400).json({ error: 'Name and price are required' });
  if (!db) return res.status(500).json({ error: 'Action unavailable; Database not configured' });

  const stmt = db.prepare('INSERT INTO products (name, price, description, img) VALUES (?, ?, ?, ?)');
  stmt.run(name, price, description || '', img || '', function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID, name: name, price: price, desc: description, img: img });
  });
  stmt.finalize();
});

app.put('/api/admin/products/:id', verifyToken, (req, res) => {
  const id = Number(req.params.id);
  const { name, price, description, img } = req.body;
  if (!db) return res.status(500).json({ error: 'Action unavailable; Database not configured' });

  const stmt = db.prepare('UPDATE products SET name = ?, price = ?, description = ?, img = ? WHERE id = ?');
  stmt.run(name, price, description || '', img || '', id, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, id, name: name, price: price, desc: description, img: img });
  });
  stmt.finalize();
});

app.delete('/api/admin/products/:id', verifyToken, (req, res) => {
  const id = Number(req.params.id);
  if (!db) return res.status(500).json({ error: 'Action unavailable; Database not configured' });
  db.run('DELETE FROM products WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, message: 'Product deleted successfully' });
  });
});

// Orders API - store into SQLite if possible, else return success and echo
app.post('/api/orders', (req, res) => {
  const { name, phone, address, notes, items, total } = req.body;
  if (!name || !phone || !address || !items) return res.status(400).json({ error: 'Missing fields' });

  if (db) {
    const stmt = db.prepare('INSERT INTO orders (customer_name, phone, address, notes, items_json, total, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const itemsJson = JSON.stringify(items);
    const created = new Date().toISOString();
    stmt.run(name, phone, address, notes || '', itemsJson, total || 0, created, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, orderId: this.lastID });
    });
    stmt.finalize();
  } else {
    // fallback: accept and echo
    res.json({ success: true, order: { name, phone, address, notes, items, total } });
  }
});

// Admin Analytics API
app.get('/api/admin/stats', verifyToken, (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not configured' });

  const stats = {};
  db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
    stats.totalProducts = row ? row.count : 0;
    db.get('SELECT COUNT(*) as count, SUM(total) as revenue FROM orders', (err, row) => {
      stats.totalOrders = row ? row.count : 0;
      stats.totalRevenue = row ? row.revenue : 0;
      res.json(stats);
    });
  });
});

// Admin Orders API
app.get('/api/admin/orders', verifyToken, (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not configured' });
  db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, items: JSON.parse(r.items_json) })));
  });
});

// Admin Settings - Change Password
app.post('/api/admin/change-password', verifyToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!db) return res.status(500).json({ error: 'Database not configured' });

  db.get('SELECT * FROM admins WHERE id = ?', [req.userId], (err, admin) => {
    if (err || !admin) return res.status(404).json({ error: 'Admin not found' });

    const passwordIsValid = bcrypt.compareSync(currentPassword, admin.password_hash);
    if (!passwordIsValid) return res.status(401).json({ error: 'Current password incorrect' });

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.run('UPDATE admins SET password_hash = ? WHERE id = ?', [newHash, req.userId], (err) => {
      if (err) return res.status(500).json({ error: 'Failed to update password' });
      res.json({ success: true, message: 'Password updated successfully' });
    });
  });
});

// Serve frontend AFTER API routes so API endpoints take priority
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
