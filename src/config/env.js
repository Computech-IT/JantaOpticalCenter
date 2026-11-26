const crypto = require("crypto");
require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret === "super_secure_secret_key") {
  if (IS_PROD) {
    // Derive a process-stable fallback instead of crashing with 503 on PaaS hosts like Hostinger,
    // while logging a critical warning to configure JWT_SECRET in environment variables.
    jwtSecret = crypto
      .createHash("sha256")
      .update(`${process.env.DB_PASSWORD || ""}:${process.cwd()}:joc-fallback`)
      .digest("hex");
    console.error(
      "[CRITICAL WARN] JWT_SECRET is not set in production! Set JWT_SECRET in your hosting Environment Variables."
    );
  } else {
    jwtSecret = crypto.randomBytes(32).toString("hex");
    console.warn(
      "[WARN] JWT_SECRET not set in .env; generated an ephemeral dev secret (tokens reset on restart)."
    );
  }
}

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

module.exports = {
  NODE_ENV,
  IS_PROD,
  PORT: parseInt(process.env.PORT || "3000", 10),
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "8h",
  ALLOWED_ORIGINS: allowedOrigins,
  DB: {
    HOST: process.env.DB_HOST || "",
    USER: process.env.DB_USER || "",
    PASSWORD: process.env.DB_PASSWORD || "",
    NAME: process.env.DB_NAME || "",
    PORT: parseInt(process.env.DB_PORT || "3306", 10),
  },
  WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER || "918768837581",
  FREE_SHIPPING_THRESHOLD: 999,
  FLAT_SHIPPING_FEE: 79,
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
};
