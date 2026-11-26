const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const env = require("../config/env");
const { prescriptionDir } = require("../middleware/upload");

// Precomputed dummy hash to equalize timing when username does not exist
const DUMMY_BCRYPT_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8lM7A8e2t3p8sR6m5eF0g2y1z9K8xS";

async function login(req, res, next) {
  try {
    const cleanUsername = String(req.body.username || "").trim().toLowerCase();
    const cleanPassword = String(req.body.password || "").trim();

    const admin = await db.getOne("SELECT * FROM admins WHERE LOWER(username) = ?", [cleanUsername]);

    if (!admin || !admin.password_hash) {
      await bcrypt.compare(cleanPassword, DUMMY_BCRYPT_HASH);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (admin.is_active === 0) {
      return res.status(403).json({ error: "This staff account is deactivated. Contact Super Admin." });
    }

    const isMatch = await bcrypt.compare(cleanPassword, admin.password_hash.trim());
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const role = admin.role || "super_admin";
    const now = new Date().toISOString();
    await db.execute("UPDATE admins SET last_login_at = ? WHERE id = ?", [now, admin.id]);

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role, type: "admin" },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    res.cookie("joc_admin_token", token, {
      httpOnly: true,
      secure: env.IS_PROD,
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
    });

    res.json({
      token,
      username: admin.username,
      fullName: admin.full_name || admin.username,
      role,
    });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie("joc_admin_token", {
    httpOnly: true,
    secure: env.IS_PROD,
    sameSite: "strict",
  });
  res.json({ success: true });
}

async function getMe(req, res, next) {
  try {
    const admin = await db.getOne(
      "SELECT id, username, full_name, email, role, is_active, last_login_at, created_at FROM admins WHERE id = ?",
      [req.user.id]
    );
    if (!admin) return res.status(404).json({ error: "Admin not found" });
    res.json({
      id: admin.id,
      username: admin.username,
      fullName: admin.full_name || admin.username,
      email: admin.email || "",
      role: admin.role || "super_admin",
      isActive: admin.is_active !== 0,
      lastLoginAt: admin.last_login_at,
    });
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await db.getOne("SELECT * FROM admins WHERE id = ?", [req.user.id]);
    if (!admin) return res.status(404).json({ error: "Admin account not found" });

    const isMatch = await bcrypt.compare(currentPassword.trim(), admin.password_hash.trim());
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await db.execute("UPDATE admins SET password_hash = ? WHERE id = ?", [newHash, admin.id]);
    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
}

async function listStaff(req, res, next) {
  try {
    const rows = await db.query(
      "SELECT id, username, full_name, email, role, is_active, last_login_at, created_at FROM admins ORDER BY id ASC"
    );
    res.json(
      rows.map((r) => ({
        id: r.id,
        username: r.username,
        fullName: r.full_name || r.username,
        email: r.email || "",
        role: r.role || "super_admin",
        isActive: r.is_active !== 0,
        lastLoginAt: r.last_login_at,
        createdAt: r.created_at,
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function createStaff(req, res, next) {
  try {
    const { username, fullName, email, role, password } = req.body;
    const normalizedUsername = username.toLowerCase();

    const existing = await db.getOne("SELECT id FROM admins WHERE LOWER(username) = ?", [
      normalizedUsername,
    ]);
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const result = await db.execute(
      "INSERT INTO admins (username, full_name, email, role, is_active, password_hash, created_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
      [normalizedUsername, fullName, email || null, role, passwordHash, now]
    );

    res.status(201).json({
      success: true,
      staff: {
        id: result.insertId,
        username: normalizedUsername,
        fullName,
        email: email || "",
        role,
        isActive: true,
        createdAt: now,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function updateStaffStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid staff ID" });
    if (id === req.user.id) {
      return res.status(400).json({ error: "You cannot deactivate your own account" });
    }

    const existing = await db.getOne("SELECT id FROM admins WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Staff member not found" });

    await db.execute("UPDATE admins SET is_active = ? WHERE id = ?", [
      req.body.isActive ? 1 : 0,
      id,
    ]);
    res.json({ success: true, isActive: req.body.isActive });
  } catch (err) {
    next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const prodRow = await db.getOne("SELECT COUNT(*) AS count FROM products");
    const orderStats = await db.getOne(
      "SELECT COUNT(*) AS totalOrders, COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS totalRevenue FROM orders"
    );
    const pendingRow = await db.getOne(
      "SELECT COUNT(*) AS count FROM orders WHERE status = 'pending' OR status IS NULL"
    );
    const recentOrders = await db.query(
      "SELECT id, order_number, customer_name, phone, total, status, items_json, prescription_json, prescription_file, created_at FROM orders ORDER BY id DESC LIMIT 25"
    );

    res.json({
      totalProducts: Number(prodRow?.count || 0),
      totalOrders: Number(orderStats?.totalOrders || 0),
      totalRevenue: Number(orderStats?.totalRevenue || 0),
      pendingOrders: Number(pendingRow?.count || 0),
      recentOrders: recentOrders.map((o) => {
        let items = [];
        let prescription = null;
        try {
          items = JSON.parse(o.items_json || "[]");
        } catch {}
        try {
          prescription = o.prescription_json ? JSON.parse(o.prescription_json) : null;
        } catch {}
        return {
          id: o.id,
          orderNumber: o.order_number || `#${o.id}`,
          customerName: o.customer_name,
          phone: o.phone,
          total: Number(o.total || 0),
          status: o.status || "pending",
          items,
          prescription,
          prescriptionFile: o.prescription_file || null,
          createdAt: o.created_at,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}

function getPrescriptionFile(req, res) {
  const safeName = path.basename(String(req.params.filename || ""));
  const fullPath = path.join(prescriptionDir, safeName);
  if (!safeName || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "Prescription file not found" });
  }
  res.sendFile(fullPath);
}

async function getExecutiveSummary(req, res, next) {
  try {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString();

    const [
      posToday,
      posMtd,
      posYtd,
      onlineToday,
      onlineMtd,
      onlineYtd,
      stockStats,
      lowStockItems,
    ] = await Promise.all([
      db.getOne("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS rev FROM sales WHERE created_at >= ?", [todayStart]),
      db.getOne("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS rev FROM sales WHERE created_at >= ?", [monthStart]),
      db.getOne("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS rev FROM sales WHERE created_at >= ?", [yearStart]),
      db.getOne("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS rev FROM orders WHERE status != 'cancelled' AND created_at >= ?", [todayStart]),
      db.getOne("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS rev FROM orders WHERE status != 'cancelled' AND created_at >= ?", [monthStart]),
      db.getOne("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS rev FROM orders WHERE status != 'cancelled' AND created_at >= ?", [yearStart]),
      db.getOne("SELECT COUNT(*) AS totalSkus, COALESCE(SUM(COALESCE(stock, 0)), 0) AS totalUnits FROM products"),
      db.query("SELECT id, sku, name, category, price, COALESCE(stock, 0) AS stock FROM products WHERE COALESCE(stock, 0) <= 5 ORDER BY stock ASC, id DESC"),
    ]);

    res.json({
      sales: {
        today: {
          revenue: Number(posToday?.rev || 0) + Number(onlineToday?.rev || 0),
          count: Number(posToday?.count || 0) + Number(onlineToday?.count || 0),
        },
        mtd: {
          revenue: Number(posMtd?.rev || 0) + Number(onlineMtd?.rev || 0),
          count: Number(posMtd?.count || 0) + Number(onlineMtd?.count || 0),
        },
        ytd: {
          revenue: Number(posYtd?.rev || 0) + Number(onlineYtd?.rev || 0),
          count: Number(posYtd?.count || 0) + Number(onlineYtd?.count || 0),
        },
      },
      inventory: {
        totalSkus: Number(stockStats?.totalSkus || 0),
        totalUnits: Number(stockStats?.totalUnits || 0),
        lowStockCount: lowStockItems.length,
        lowStockItems,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  login,
  logout,
  getMe,
  changePassword,
  listStaff,
  createStaff,
  updateStaffStatus,
  getAnalytics,
  getExecutiveSummary,
  getPrescriptionFile,
};
