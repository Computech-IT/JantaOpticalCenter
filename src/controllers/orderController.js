const crypto = require("crypto");
const db = require("../db");
const env = require("../config/env");
const { LENS_PACKAGES } = require("../schemas/validation");

function generateOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `JOC-${date}-${rand}`;
}

async function createOrder(req, res, next) {
  try {
    const { name, phone, email, address, notes, paymentMethod, prescription, items } = req.body;
    const customerId = req.customer?.id || null;
    const customerEmail = email || req.customer?.email || null;
    const prescriptionFile = req.file ? req.file.filename : null;

    // Fetch authoritative prices from DB — never trust client totals
    const productIds = [...new Set(items.map((i) => i.id))];
    const placeholders = productIds.map(() => "?").join(",");
    const dbProducts = await db.query(
      `SELECT id, name, price, stock FROM products WHERE id IN (${placeholders})`,
      productIds
    );
    const productMap = new Map(dbProducts.map((p) => [Number(p.id), p]));

    const verifiedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const prod = productMap.get(Number(item.id));
      if (!prod) {
        return res.status(400).json({ error: `Product ID ${item.id} is no longer available.` });
      }
      const lens = LENS_PACKAGES[item.lensPackage || "frame_only"] || LENS_PACKAGES.frame_only;
      const unitPrice = Number(prod.price) + lens.price;
      const lineTotal = unitPrice * item.qty;
      subtotal += lineTotal;

      verifiedItems.push({
        id: prod.id,
        name: prod.name,
        framePrice: Number(prod.price),
        lensPackage: item.lensPackage || "frame_only",
        lensLabel: lens.label,
        lensPrice: lens.price,
        unitPrice,
        qty: item.qty,
        lineTotal,
      });
    }

    const shippingFee = subtotal >= env.FREE_SHIPPING_THRESHOLD ? 0 : env.FLAT_SHIPPING_FEE;
    const total = subtotal + shippingFee;
    const orderNumber = generateOrderNumber();
    const now = new Date().toISOString();

    const result = await db.execute(
      `INSERT INTO orders (order_number, customer_id, customer_name, customer_email, phone, address, notes, items_json, prescription_json, prescription_file, subtotal, shipping_fee, total, status, payment_method, payment_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'unpaid', ?, ?)`,
      [
        orderNumber,
        customerId,
        name,
        customerEmail,
        phone,
        address,
        notes || "",
        JSON.stringify(verifiedItems),
        prescription ? JSON.stringify(prescription) : null,
        prescriptionFile,
        subtotal,
        shippingFee,
        total,
        paymentMethod || "cod",
        now,
        now,
      ]
    );

    res.status(201).json({
      success: true,
      orderId: result.insertId,
      orderNumber,
      subtotal,
      shippingFee,
      total,
      status: "pending",
      items: verifiedItems,
    });
  } catch (err) {
    next(err);
  }
}

async function trackOrder(req, res, next) {
  try {
    const { orderNumber, phone } = req.query;
    if (!orderNumber || !phone) {
      return res.status(400).json({ error: "Order number and phone number are required" });
    }
    const cleanPhone = String(phone).replace(/\D/g, "").slice(-10);
    const order = await db.getOne(
      "SELECT id, order_number, customer_name, phone, subtotal, shipping_fee, total, status, payment_method, items_json, created_at FROM orders WHERE order_number = ?",
      [String(orderNumber).trim().toUpperCase()]
    );
    if (!order || !String(order.phone || "").replace(/\D/g, "").endsWith(cleanPhone)) {
      return res.status(404).json({ error: "Order not found. Please verify your Order Number and Phone." });
    }
    let items = [];
    try {
      items = JSON.parse(order.items_json || "[]");
    } catch {}
    res.json({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      status: order.status || "pending",
      paymentMethod: order.payment_method || "cod",
      subtotal: order.subtotal ?? order.total,
      shippingFee: order.shipping_fee ?? 0,
      total: order.total,
      items,
      createdAt: order.created_at,
    });
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const rows = await db.query(
      "SELECT id, order_number, customer_name, customer_email, phone, address, notes, items_json, subtotal, shipping_fee, total, status, payment_method, payment_status, created_at FROM orders ORDER BY id DESC LIMIT 100"
    );
    const formatted = rows.map((r) => {
      let items = [];
      try {
        items = JSON.parse(r.items_json || "[]");
      } catch {}
      return {
        ...r,
        items,
      };
    });
    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

    const existing = await db.getOne("SELECT id FROM orders WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Order not found" });

    const now = new Date().toISOString();
    await db.execute("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?", [
      req.body.status,
      now,
      id,
    ]);
    res.json({ success: true, status: req.body.status });
  } catch (err) {
    next(err);
  }
}

async function getOrderInvoice(req, res, next) {
  try {
    const orderNumber = String(req.params.orderNumber || "").trim().toUpperCase();
    const phone = String(req.query.phone || "").replace(/\D/g, "").slice(-10);
    if (!orderNumber || !phone) {
      return res.status(400).json({ error: "Order number and phone are required" });
    }

    const order = await db.getOne(
      `SELECT order_number, customer_name, phone, address, subtotal, shipping_fee, total, status, payment_method, payment_status, items_json, created_at
       FROM orders WHERE order_number = ?`,
      [orderNumber]
    );
    if (!order || !String(order.phone || "").replace(/\D/g, "").endsWith(phone)) {
      return res.status(404).json({ error: "Invoice not found. Verify order number and phone." });
    }

    let items = [];
    try {
      items = JSON.parse(order.items_json || "[]");
    } catch {}

    const subtotal = Number(order.subtotal ?? order.total ?? 0);
    const taxableValue = Math.round((subtotal / 1.12) * 100) / 100;
    const totalGst = Math.round((subtotal - taxableValue) * 100) / 100;
    const halfGst = Math.round((totalGst / 2) * 100) / 100;

    res.json({
      orderNumber: order.order_number,
      customerName: order.customer_name,
      phone: order.phone,
      address: order.address,
      status: order.status || "pending",
      paymentMethod: order.payment_method || "cod",
      paymentStatus: order.payment_status || "unpaid",
      items,
      subtotal,
      shippingFee: Number(order.shipping_fee ?? 0),
      total: Number(order.total ?? subtotal),
      gst: {
        ratePercent: 12,
        taxableValue,
        cgst: halfGst,
        sgst: halfGst,
      },
      createdAt: order.created_at,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  trackOrder,
  listOrders,
  updateOrderStatus,
  getOrderInvoice,
};
