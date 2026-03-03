require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "super_secure_secret_key";

// ---------------- MIDDLEWARE ----------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// ---------------- UPLOAD FOLDER ----------------
const uploadDir = path.join(__dirname, "public/images/products");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ---------------- MULTER CONFIG ----------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, uuidv4() + path.extname(file.originalname).toLowerCase()),
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024, files: 4 } });

// ---------------- DATABASE ----------------
let db;
const isProd = process.env.DB_HOST ? true : false;

if (isProd) {
  const mysql = require("mysql2");
  db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  db.connect((err) => {
    if (err) {
      console.error("MySQL Connection Failed (Critical):", err);
      // Removed process.exit(1) to prevent 503 on temporary DB issues
      // The app will stay alive and serve static content or return errors via APIs
    } else {
      console.log("Connected to MySQL");
    }
  });
} else {
  const sqlite3 = require("sqlite3").verbose();
  const dbPath = path.join(__dirname, "data", "products.db");
  db = new sqlite3.Database(dbPath, (err) => {
    if (err) return console.error("SQLite error:", err);
    console.log("Connected to SQLite");
  });
}

// Helper to execute queries with Promise
const queryAsync = (query, params = []) => {
  return new Promise((resolve, reject) => {
    if (isProd) {
      db.query(query, params, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    } else {
      if (query.toLowerCase().includes("insert") || query.toLowerCase().includes("update") || query.toLowerCase().includes("delete")) {
        db.run(query, params, function (err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        });
      } else {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      }
    }
  });
};

// ---------------- JWT MIDDLEWARE ----------------
const verifyToken = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(403).json({ error: "No token provided" });

  const token = header.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("JWT Verification failed:", err.message);
      return res.status(401).json({ error: "Unauthorized: Token invalid or expired" });
    }
    req.userId = decoded.id;
    next();
  });
};

// ---------------- ADMIN LOGIN ----------------
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  const query = "SELECT * FROM admins WHERE username = ?";

  const handleLogin = async (err, row) => {
    if (err) return res.status(500).json({ error: "Server error" });
    if (!row || !row.password_hash) return res.status(401).json({ error: "Invalid credentials" });

    try {
      const cleanPassword = password.trim();
      const hash = row.password_hash.trim();

      const isMatch = await bcrypt.compare(cleanPassword, hash);
      if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

      const token = jwt.sign({ id: row.id }, JWT_SECRET, { expiresIn: "8h" });
      res.json({ token, username: row.username });
    } catch (bcryptErr) {
      console.error("Bcrypt error:", bcryptErr);
      res.status(500).json({ error: "Server error" });
    }
  };

  if (isProd) {
    db.query(query, [username], (err, results) => handleLogin(err, results[0]));
  } else {
    db.get(query, [username], handleLogin);
  }
});

// ---------------- PRODUCTS API ----------------

// GET PRODUCTS
app.get("/api/products", (req, res) => {
  const query = "SELECT * FROM products ORDER BY id DESC";

  if (isProd) {
    db.query(query, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const formatted = rows.map((p) => ({
        ...p,
        images: p.img ? p.img.split(",").filter(img => img) : []
      }));
      res.json(formatted);
    });
  } else {
    db.all(query, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      const formatted = rows.map((p) => ({
        ...p,
        images: p.img ? p.img.split(",").filter(img => img) : []
      }));
      res.json(formatted);
    });
  }
});

// ADD PRODUCT (MULTIPLE IMAGES)
app.post("/api/admin/products", verifyToken, upload.array("images", 4), (req, res) => {
  const { name, price, description } = req.body;

  console.log("=== POST /api/admin/products ===");
  console.log("Body:", { name, price, description });
  console.log("Files received:", req.files?.length || 0);
  console.log("Files:", req.files);

  if (!name || !price) return res.status(400).json({ error: "Name and price required" });

  // Join all filenames with comma
  const filenames = req.files ? req.files.map(f => f.filename).join(",") : "";

  console.log("Filenames to save:", filenames);

  const query = "INSERT INTO products (name, price, description, img) VALUES (?, ?, ?, ?)";

  if (isProd) {
    db.query(query, [name, price, description || "", filenames], function (err) {
      if (err) {
        console.error("DB error:", err);
        return res.status(500).json({ error: err.message });
      }
      console.log("Product saved with ID:", this.insertId);
      res.json({ success: true, id: this.insertId });
    });
  } else {
    db.run(query, [name, price, description || "", filenames], function (err) {
      if (err) {
        console.error("DB error:", err);
        return res.status(500).json({ error: err.message });
      }
      console.log("Product saved with ID:", this.lastID);
      res.json({ success: true, id: this.lastID });
    });
  }
});

// UPDATE PRODUCT (MULTIPLE IMAGES)
app.put("/api/admin/products/:id", verifyToken, upload.array("images", 4), (req, res) => {
  const id = req.params.id;
  const { name, price, description } = req.body;

  const selectQuery = "SELECT img FROM products WHERE id = ?";

  const handleUpdate = (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Product not found" });

    let newImages = row.img || "";

    // If new images are uploaded, replace old ones
    if (req.files && req.files.length > 0) {
      // Delete old image files
      if (row.img) {
        const oldImages = row.img.split(",").filter(img => img);
        oldImages.forEach(img => {
          const oldPath = path.join(uploadDir, img);
          try {
            if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
          } catch (e) {
            console.error("Error deleting old image:", e);
          }
        });
      }
      // Set new images
      newImages = req.files.map(f => f.filename).join(",");
    }

    const updateQuery = "UPDATE products SET name=?, price=?, description=?, img=? WHERE id=?";

    if (isProd) {
      db.query(updateQuery, [name, price, description || "", newImages, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    } else {
      db.run(updateQuery, [name, price, description || "", newImages, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    }
  };

  if (isProd) {
    db.query(selectQuery, [id], (err, results) => handleUpdate(err, results[0]));
  } else {
    db.get(selectQuery, [id], handleUpdate);
  }
});

// DELETE PRODUCT
app.delete("/api/admin/products/:id", verifyToken, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });

  console.log("Attempting to delete product ID:", id);

  const selectQuery = "SELECT img FROM products WHERE id = ?";

  const handleDelete = (err, row) => {
    if (err) {
      console.error("DB error:", err);
      return res.status(500).json({ error: "Server error" });
    }

    console.log("Row found:", row);

    if (!row) return res.status(404).json({ error: "Product not found" });

    // Delete all image files
    if (row.img) {
      const images = row.img.split(",").filter(img => img);
      images.forEach(img => {
        const filePath = path.join(uploadDir, img);
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (fsErr) {
          console.error("Error deleting image file:", fsErr);
        }
      });
    }

    // Delete the product row
    const deleteQuery = "DELETE FROM products WHERE id = ?";

    if (isProd) {
      db.query(deleteQuery, [id], function (err) {
        if (err) {
          console.error("DB delete error:", err);
          return res.status(500).json({ error: err.message });
        }
        console.log(`Product ID ${id} deleted successfully`);
        res.json({ success: true });
      });
    } else {
      db.run(deleteQuery, [id], function (err) {
        if (err) {
          console.error("DB delete error:", err);
          return res.status(500).json({ error: err.message });
        }
        console.log(`Product ID ${id} deleted successfully`);
        res.json({ success: true });
      });
    }
  };

  if (isProd) {
    db.query(selectQuery, [id], (err, results) => handleDelete(err, results[0]));
  } else {
    db.get(selectQuery, [id], handleDelete);
  }
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));