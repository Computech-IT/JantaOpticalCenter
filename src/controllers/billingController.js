const crypto = require("crypto");
const db = require("../db");
const { LENS_PACKAGES } = require("../schemas/validation");

function generateInvoiceNumber() {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `INV-${d}-${rand}`;
}

async function createSale(req, res, next) {
  try {
    const { customerName, customerPhone, items, discount, paymentMethod, prescription, notes } =
      req.body;

    let subtotal = 0;
    const billedItems = [];

    for (const item of items) {
      let unitFramePrice = Number(item.unitPrice || 0);
      let productName = item.name || "Custom Eyewear";

      if (item.productId) {
        const prod = await db.getOne("SELECT id, name, price, stock FROM products WHERE id = ?", [
          item.productId,
        ]);
        if (!prod) {
          return res.status(400).json({ error: `Product ID ${item.productId} not found.` });
        }
        unitFramePrice = Number(prod.price);
        productName = prod.name;

        // Decrement stock safely if tracked
        const newStock = Math.max(0, Number(prod.stock ?? 0) - item.qty);
        await db.execute("UPDATE products SET stock = ? WHERE id = ?", [newStock, prod.id]);
      }

      const lens = LENS_PACKAGES[item.lensPackage || "frame_only"] || LENS_PACKAGES.frame_only;
      const unitPrice = unitFramePrice + lens.price;
      const lineTotal = unitPrice * item.qty;
      subtotal += lineTotal;

      billedItems.push({
        productId: item.productId || null,
        name: productName,
        framePrice: unitFramePrice,
        lensPackage: item.lensPackage || "frame_only",
        lensLabel: lens.label,
        lensPrice: lens.price,
        unitPrice,
        qty: item.qty,
        lineTotal,
      });
    }

    const safeDiscount = Math.min(subtotal, Math.max(0, Number(discount || 0)));
    const total = Math.max(0, subtotal - safeDiscount);
    const invoiceNumber = generateInvoiceNumber();
    const now = new Date().toISOString();

    const result = await db.execute(
      `INSERT INTO sales (invoice_number, customer_name, customer_phone, items_json, prescription_json, subtotal, discount, total, payment_method, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNumber,
        customerName,
        customerPhone || "",
        JSON.stringify(billedItems),
        prescription ? JSON.stringify(prescription) : null,
        subtotal,
        safeDiscount,
        total,
        paymentMethod || "cash",
        notes || "",
        req.user?.username || "staff",
        now,
        now,
      ]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      invoiceNumber,
      customerName,
      customerPhone: customerPhone || "",
      items: billedItems,
      subtotal,
      discount: safeDiscount,
      total,
      paymentMethod: paymentMethod || "cash",
      createdAt: now,
    });
  } catch (err) {
    next(err);
  }
}

async function listSales(req, res, next) {
  try {
    const rawDays = parseInt(req.query.days || "30", 10);
    // Staff can filter up to 30 days; super_admin can query up to 365 days
    const maxDays = req.user?.role === "super_admin" ? 365 : 30;
    const days = Math.min(maxDays, Math.max(1, isNaN(rawDays) ? 30 : rawDays));
    const sinceIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const q = String(req.query.q || "").trim().toLowerCase();

    let sql = "SELECT * FROM sales WHERE created_at >= ?";
    const params = [sinceIso];

    if (q) {
      sql += " AND (LOWER(invoice_number) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(COALESCE(customer_phone, '')) LIKE ?)";
      const term = `%${q}%`;
      params.push(term, term, term);
    }

    sql += " ORDER BY id DESC LIMIT 250";
    const rows = await db.query(sql, params);

    const sales = rows.map((r) => {
      let items = [];
      let prescription = null;
      try {
        items = JSON.parse(r.items_json || "[]");
      } catch {}
      try {
        prescription = r.prescription_json ? JSON.parse(r.prescription_json) : null;
      } catch {}
      return {
        id: r.id,
        invoiceNumber: r.invoice_number,
        customerName: r.customer_name,
        customerPhone: r.customer_phone || "",
        items,
        prescription,
        subtotal: Number(r.subtotal || 0),
        discount: Number(r.discount || 0),
        total: Number(r.total || 0),
        paymentMethod: r.payment_method || "cash",
        notes: r.notes || "",
        createdBy: r.created_by || "staff",
        createdAt: r.created_at,
      };
    });

    const summary = {
      count: sales.length,
      totalRevenue: sales.reduce((sum, s) => sum + s.total, 0),
      days,
    };

    res.json({ summary, sales });
  } catch (err) {
    next(err);
  }
}

async function updateSale(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid sale ID" });

    const existing = await db.getOne("SELECT * FROM sales WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Sales record not found" });

    const { customerName, customerPhone, discount, paymentMethod, notes } = req.body;
    const subtotal = Number(existing.subtotal || 0);
    const safeDiscount =
      discount !== undefined
        ? Math.min(subtotal, Math.max(0, Number(discount)))
        : Number(existing.discount || 0);
    const total = Math.max(0, subtotal - safeDiscount);
    const now = new Date().toISOString();

    await db.execute(
      `UPDATE sales
       SET customer_name = ?, customer_phone = ?, discount = ?, total = ?, payment_method = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      [
        customerName ?? existing.customer_name,
        customerPhone ?? existing.customer_phone,
        safeDiscount,
        total,
        paymentMethod ?? existing.payment_method,
        notes ?? existing.notes,
        now,
        id,
      ]
    );

    res.json({ success: true, total, discount: safeDiscount });
  } catch (err) {
    next(err);
  }
}

async function deleteSale(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid sale ID" });

    const existing = await db.getOne("SELECT id FROM sales WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Sales record not found" });

    await db.execute("DELETE FROM sales WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function getSaleInvoice(req, res, next) {
  try {
    const invoiceNumber = String(req.params.invoiceNumber || "").trim().toUpperCase();
    const sale = await db.getOne("SELECT * FROM sales WHERE invoice_number = ?", [invoiceNumber]);
    if (!sale) return res.status(404).json({ error: "Invoice not found" });

    let items = [];
    try {
      items = JSON.parse(sale.items_json || "[]");
    } catch {}

    const total = Number(sale.total || 0);
    const taxableValue = Math.round((total / 1.12) * 100) / 100;
    const totalGst = Math.round((total - taxableValue) * 100) / 100;
    const halfGst = Math.round((totalGst / 2) * 100) / 100;

    res.json({
      orderNumber: sale.invoice_number,
      customerName: sale.customer_name,
      phone: sale.customer_phone || "Walk-in",
      address: "In-Store POS Billing — Pakyong, East Sikkim",
      status: "completed",
      paymentMethod: sale.payment_method || "cash",
      paymentStatus: "paid",
      items,
      subtotal: Number(sale.subtotal || total),
      discount: Number(sale.discount || 0),
      shippingFee: 0,
      total,
      gst: {
        ratePercent: 12,
        taxableValue,
        cgst: halfGst,
        sgst: halfGst,
      },
      createdAt: sale.created_at,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createSale,
  listSales,
  updateSale,
  deleteSale,
  getSaleInvoice,
};
