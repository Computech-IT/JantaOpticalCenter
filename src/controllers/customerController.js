const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const env = require("../config/env");

function setCustomerCookie(res, token) {
  res.cookie("joc_customer_token", token, {
    httpOnly: true,
    secure: env.IS_PROD,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

async function register(req, res, next) {
  try {
    const { name, email, phone, password } = req.body;
    const normalizedEmail = email.toLowerCase();

    const existing = await db.getOne("SELECT id FROM customers WHERE email = ?", [normalizedEmail]);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const result = await db.execute(
      "INSERT INTO customers (name, email, phone, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
      [name, normalizedEmail, phone || null, passwordHash, now]
    );

    const customer = { id: result.insertId, name, email: normalizedEmail, phone: phone || "" };
    const token = jwt.sign(
      { id: customer.id, email: customer.email, name: customer.name, role: "customer" },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    setCustomerCookie(res, token);
    res.status(201).json({ customer, token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase();
    const customer = await db.getOne("SELECT * FROM customers WHERE email = ?", [normalizedEmail]);
    if (!customer) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, customer.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: customer.id, email: customer.email, name: customer.name, role: "customer" },
      env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    setCustomerCookie(res, token);
    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || "",
      },
      token,
    });
  } catch (err) {
    next(err);
  }
}

function logout(req, res) {
  res.clearCookie("joc_customer_token", {
    httpOnly: true,
    secure: env.IS_PROD,
    sameSite: "strict",
  });
  res.json({ success: true });
}

async function getProfile(req, res, next) {
  try {
    const customer = await db.getOne(
      "SELECT id, name, email, phone, created_at FROM customers WHERE id = ?",
      [req.customer.id]
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT id, order_number, subtotal, shipping_fee, total, status, payment_method, payment_status, items_json, created_at
       FROM orders
       WHERE customer_id = ? OR LOWER(customer_email) = ?
       ORDER BY id DESC LIMIT 50`,
      [req.customer.id, req.customer.email.toLowerCase()]
    );
    res.json(
      rows.map((r) => {
        let items = [];
        try {
          items = JSON.parse(r.items_json || "[]");
        } catch {}
        return { ...r, items };
      })
    );
  } catch (err) {
    next(err);
  }
}

async function listPrescriptions(req, res, next) {
  try {
    const rows = await db.query(
      "SELECT id, label, od_sph, od_cyl, od_axis, os_sph, os_cyl, os_axis, pd, notes, file_path, created_at FROM prescriptions WHERE customer_id = ? ORDER BY id DESC",
      [req.customer.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function savePrescription(req, res, next) {
  try {
    const { label, od_sph, od_cyl, od_axis, os_sph, os_cyl, os_axis, pd, notes } = req.body;
    const now = new Date().toISOString();
    const result = await db.execute(
      `INSERT INTO prescriptions (customer_id, label, od_sph, od_cyl, od_axis, os_sph, os_cyl, os_axis, pd, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.customer.id,
        label || "My Prescription",
        od_sph || "",
        od_cyl || "",
        od_axis || "",
        os_sph || "",
        os_cyl || "",
        os_axis || "",
        pd || "",
        notes || "",
        now,
      ]
    );
    const created = await db.getOne("SELECT * FROM prescriptions WHERE id = ?", [result.insertId]);
    res.status(201).json({ success: true, prescription: created });
  } catch (err) {
    next(err);
  }
}

async function deletePrescription(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid prescription ID" });
    await db.execute("DELETE FROM prescriptions WHERE id = ? AND customer_id = ?", [
      id,
      req.customer.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  getProfile,
  getMyOrders,
  listPrescriptions,
  savePrescription,
  deletePrescription,
};
