const db = require("./index");

async function ensureColumn(table, column, definition) {
  if (db.isMysql) {
    const cols = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (cols.length === 0) {
      await db.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  } else {
    const cols = await db.query(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === column)) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

async function runMigrations() {
  if (!db.isMysql) {
    await db.execute(`CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      description TEXT,
      img TEXT
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      phone TEXT,
      address TEXT,
      notes TEXT,
      items_json TEXT,
      total INTEGER,
      created_at TEXT
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT,
      created_at TEXT
    )`);
  }

  // Evolve products table with enterprise optical catalog fields
  await ensureColumn("products", "sku", "VARCHAR(64)");
  await ensureColumn("products", "slug", "VARCHAR(255)");
  await ensureColumn("products", "category", "VARCHAR(64) DEFAULT 'eyeglasses'");
  await ensureColumn("products", "shape", "VARCHAR(64) DEFAULT 'wayfarer'");
  await ensureColumn("products", "gender", "VARCHAR(32) DEFAULT 'unisex'");
  await ensureColumn("products", "frame_material", "VARCHAR(64) DEFAULT 'Acetate'");
  await ensureColumn("products", "frame_size", "VARCHAR(32) DEFAULT 'Medium'");
  await ensureColumn("products", "stock", "INTEGER DEFAULT 25");
  await ensureColumn("products", "is_active", "INTEGER DEFAULT 1");
  await ensureColumn("products", "created_at", "TEXT");

  // Evolve orders table with OMS & Payment fields
  await ensureColumn("orders", "order_number", "VARCHAR(64)");
  await ensureColumn("orders", "customer_id", "INTEGER");
  await ensureColumn("orders", "customer_email", "VARCHAR(255)");
  await ensureColumn("orders", "status", "VARCHAR(32) DEFAULT 'pending'");
  await ensureColumn("orders", "payment_method", "VARCHAR(32) DEFAULT 'cod'");
  await ensureColumn("orders", "payment_status", "VARCHAR(32) DEFAULT 'unpaid'");
  await ensureColumn("orders", "razorpay_order_id", "VARCHAR(128)");
  await ensureColumn("orders", "razorpay_payment_id", "VARCHAR(128)");
  await ensureColumn("orders", "prescription_json", "TEXT");
  await ensureColumn("orders", "prescription_file", "VARCHAR(255)");
  await ensureColumn("orders", "subtotal", "INTEGER DEFAULT 0");
  await ensureColumn("orders", "shipping_fee", "INTEGER DEFAULT 0");
  await ensureColumn("orders", "updated_at", "TEXT");

  // Customers & Saved Prescriptions tables
  if (db.isMysql) {
    await db.execute(`CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      phone VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      created_at TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await db.execute(`CREATE TABLE IF NOT EXISTS prescriptions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      label VARCHAR(100) DEFAULT 'My Prescription',
      od_sph VARCHAR(16),
      od_cyl VARCHAR(16),
      od_axis VARCHAR(16),
      os_sph VARCHAR(16),
      os_cyl VARCHAR(16),
      os_axis VARCHAR(16),
      pd VARCHAR(16),
      notes TEXT,
      file_path VARCHAR(255),
      created_at TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  } else {
    await db.execute(`CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      label TEXT DEFAULT 'My Prescription',
      od_sph TEXT,
      od_cyl TEXT,
      od_axis TEXT,
      os_sph TEXT,
      os_cyl TEXT,
      os_axis TEXT,
      pd TEXT,
      notes TEXT,
      file_path TEXT,
      created_at TEXT
    )`);
  }

  // POS Billing / Daily Sales table
  if (db.isMysql) {
    await db.execute(`CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_number VARCHAR(64) NOT NULL UNIQUE,
      customer_name VARCHAR(120) NOT NULL,
      customer_phone VARCHAR(20),
      items_json LONGTEXT NOT NULL,
      prescription_json TEXT,
      subtotal INT NOT NULL DEFAULT 0,
      discount INT NOT NULL DEFAULT 0,
      total INT NOT NULL DEFAULT 0,
      payment_method VARCHAR(32) DEFAULT 'cash',
      notes TEXT,
      created_by VARCHAR(50),
      created_at TEXT,
      updated_at TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  } else {
    await db.execute(`CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      items_json TEXT NOT NULL,
      prescription_json TEXT,
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      notes TEXT,
      created_by TEXT,
      created_at TEXT,
      updated_at TEXT
    )`);
  }

  // Evolve admins table with RBAC & staff management fields
  await ensureColumn("admins", "full_name", "VARCHAR(120)");
  await ensureColumn("admins", "email", "VARCHAR(255)");
  await ensureColumn("admins", "role", "VARCHAR(32) DEFAULT 'super_admin'");
  await ensureColumn("admins", "is_active", "INTEGER DEFAULT 1");
  await ensureColumn("admins", "last_login_at", "TEXT");

  // Ensure default admin has super_admin role
  await db.execute("UPDATE admins SET role = 'super_admin', is_active = 1 WHERE role IS NULL");

  // Backfill slugs/categories for existing rows if missing
  const existingProducts = await db.query("SELECT id, name, slug, category, shape FROM products");
  for (const p of existingProducts) {
    if (!p.slug) {
      const baseSlug = String(p.name || "frame")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const slug = `${baseSlug}-${p.id}`;
      const lower = (p.name || "").toLowerCase();
      let shape = p.shape || "wayfarer";
      if (lower.includes("cat")) shape = "cat-eye";
      else if (lower.includes("aviator")) shape = "aviator";
      else if (lower.includes("round")) shape = "round";
      else if (lower.includes("square")) shape = "square";

      await db.execute(
        "UPDATE products SET slug = ?, sku = ?, shape = ? WHERE id = ?",
        [slug, `JOC-${String(p.id).padStart(4, "0")}`, shape, p.id]
      );
    }
  }

  console.log("[DB] Migrations verified");
}

module.exports = { runMigrations };
