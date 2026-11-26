const crypto = require("crypto");
const db = require("../db");
const env = require("../config/env");

function isRazorpayConfigured() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

function getPaymentConfig(req, res) {
  res.json({
    razorpayEnabled: isRazorpayConfigured(),
    razorpayKeyId: isRazorpayConfigured() ? env.RAZORPAY_KEY_ID : null,
  });
}

function verifyRazorpaySignature(orderId, paymentId, signature, secret = env.RAZORPAY_KEY_SECRET) {
  if (!secret || !orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const sigBuf = Buffer.from(String(signature), "utf8");
  if (expectedBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

async function createRazorpayOrder(req, res, next) {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        error: "Online payment gateway (Razorpay) is not configured yet. Please use Cash/UPI on Delivery.",
      });
    }

    const { orderNumber } = req.body;
    const order = await db.getOne("SELECT id, order_number, total FROM orders WHERE order_number = ?", [
      orderNumber,
    ]);
    if (!order) return res.status(404).json({ error: "Order not found" });

    const amountPaise = Math.round(Number(order.total) * 100);
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64");

    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: order.order_number,
      }),
    });

    const rzpData = await rzpRes.json();
    if (!rzpRes.ok) {
      return res.status(502).json({ error: rzpData.error?.description || "Payment gateway error" });
    }

    await db.execute("UPDATE orders SET razorpay_order_id = ? WHERE id = ?", [
      rzpData.id,
      order.id,
    ]);

    res.json({
      razorpayOrderId: rzpData.id,
      amount: rzpData.amount,
      currency: rzpData.currency,
      keyId: env.RAZORPAY_KEY_ID,
      orderNumber: order.order_number,
    });
  } catch (err) {
    next(err);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const { orderNumber, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    const now = new Date().toISOString();
    await db.execute(
      "UPDATE orders SET payment_status = 'paid', status = 'confirmed', razorpay_payment_id = ?, updated_at = ? WHERE order_number = ? AND razorpay_order_id = ?",
      [razorpay_payment_id, now, orderNumber, razorpay_order_id]
    );

    res.json({ success: true, orderNumber, paymentStatus: "paid", status: "confirmed" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPaymentConfig,
  createRazorpayOrder,
  verifyPayment,
  verifyRazorpaySignature,
};
