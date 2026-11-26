const express = require("express");
const router = express.Router();

const db = require("../db");
const { verifyToken, requireRole } = require("../middleware/auth");
const { verifyCustomer, optionalCustomer } = require("../middleware/customerAuth");
const { authLimiter, orderLimiter } = require("../middleware/security");
const { validate } = require("../middleware/validate");
const {
  upload,
  verifyUploadedImages,
  prescriptionUpload,
  verifyUploadedPrescription,
} = require("../middleware/upload");
const {
  loginSchema,
  changePasswordSchema,
  productBodySchema,
  createOrderSchema,
  updateOrderStatusSchema,
  createStaffSchema,
  updateStaffStatusSchema,
  createSaleSchema,
  updateSaleSchema,
  customerRegisterSchema,
  customerLoginSchema,
  prescriptionSchema,
  razorpayOrderSchema,
  razorpayVerifySchema,
  LENS_PACKAGES,
} = require("../schemas/validation");

const productCtrl = require("../controllers/productController");
const orderCtrl = require("../controllers/orderController");
const adminCtrl = require("../controllers/adminController");
const billingCtrl = require("../controllers/billingController");
const customerCtrl = require("../controllers/customerController");
const paymentCtrl = require("../controllers/paymentController");

// Health & Metadata
router.get("/health", async (req, res) => {
  const dbStatus = await db.healthCheck();
  const statusCode = dbStatus.status === "up" ? 200 : 503;
  res.status(statusCode).json({
    status: dbStatus.status === "up" ? "ok" : "degraded",
    uptime: Math.floor(process.uptime()),
    db: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

router.get("/lens-packages", (req, res) => {
  res.json(LENS_PACKAGES);
});

// Public Products
router.get("/products", productCtrl.listProducts);
router.get("/products/:idOrSlug", productCtrl.getProduct);

function parseMultipartOrderFields(req, _res, next) {
  if (typeof req.body.items === "string") {
    try {
      req.body.items = JSON.parse(req.body.items);
    } catch {}
  }
  if (typeof req.body.prescription === "string") {
    try {
      req.body.prescription = JSON.parse(req.body.prescription);
    } catch {}
  }
  next();
}

// Public Orders & Tracking
router.post(
  "/orders",
  orderLimiter,
  optionalCustomer,
  prescriptionUpload.single("prescriptionFile"),
  verifyUploadedPrescription,
  parseMultipartOrderFields,
  validate(createOrderSchema),
  orderCtrl.createOrder
);
router.get("/orders/track", orderCtrl.trackOrder);
router.get("/orders/:orderNumber/invoice", orderCtrl.getOrderInvoice);

// Payment Gateway (Razorpay)
router.get("/payments/config", paymentCtrl.getPaymentConfig);
router.post("/payments/razorpay/order", orderLimiter, validate(razorpayOrderSchema), paymentCtrl.createRazorpayOrder);
router.post("/payments/razorpay/verify", validate(razorpayVerifySchema), paymentCtrl.verifyPayment);

// Customer Accounts & Prescriptions
router.post("/customers/register", authLimiter, validate(customerRegisterSchema), customerCtrl.register);
router.post("/customers/login", authLimiter, validate(customerLoginSchema), customerCtrl.login);
router.post("/customers/logout", customerCtrl.logout);
router.get("/customers/me", verifyCustomer, customerCtrl.getProfile);
router.get("/customers/orders", verifyCustomer, customerCtrl.getMyOrders);
router.get("/customers/prescriptions", verifyCustomer, customerCtrl.listPrescriptions);
router.post("/customers/prescriptions", verifyCustomer, validate(prescriptionSchema), customerCtrl.savePrescription);
router.delete("/customers/prescriptions/:id", verifyCustomer, customerCtrl.deletePrescription);

// Admin Auth
router.post("/admin/login", authLimiter, validate(loginSchema), adminCtrl.login);
router.post("/admin/logout", adminCtrl.logout);

// Protected Admin Routes
router.get("/admin/me", verifyToken, adminCtrl.getMe);
router.post(
  "/admin/change-password",
  verifyToken,
  validate(changePasswordSchema),
  adminCtrl.changePassword
);
router.get("/admin/staff", verifyToken, requireRole("super_admin"), adminCtrl.listStaff);
router.post(
  "/admin/staff",
  verifyToken,
  requireRole("super_admin"),
  validate(createStaffSchema),
  adminCtrl.createStaff
);
router.patch(
  "/admin/staff/:id/status",
  verifyToken,
  requireRole("super_admin"),
  validate(updateStaffStatusSchema),
  adminCtrl.updateStaffStatus
);
router.get("/admin/analytics", verifyToken, requireRole("super_admin"), adminCtrl.getAnalytics);
router.get("/admin/executive-summary", verifyToken, requireRole("super_admin"), adminCtrl.getExecutiveSummary);
router.get("/admin/prescriptions/:filename", verifyToken, adminCtrl.getPrescriptionFile);
router.get("/admin/orders", verifyToken, adminCtrl.getAnalytics);

// POS Billing & Daily Sales Reports (Accessible to all authenticated Staff & Super Admin)
router.get("/admin/sales", verifyToken, billingCtrl.listSales);
router.post("/admin/sales", verifyToken, validate(createSaleSchema), billingCtrl.createSale);
router.put("/admin/sales/:id", verifyToken, validate(updateSaleSchema), billingCtrl.updateSale);
router.delete("/admin/sales/:id", verifyToken, billingCtrl.deleteSale);
router.get("/admin/sales/:invoiceNumber/invoice", verifyToken, billingCtrl.getSaleInvoice);
router.patch(
  "/admin/orders/:id/status",
  verifyToken,
  validate(updateOrderStatusSchema),
  orderCtrl.updateOrderStatus
);

router.post(
  "/admin/products",
  verifyToken,
  upload.array("images", 4),
  verifyUploadedImages,
  validate(productBodySchema),
  productCtrl.createProduct
);
router.put(
  "/admin/products/:id",
  verifyToken,
  upload.array("images", 4),
  verifyUploadedImages,
  validate(productBodySchema),
  productCtrl.updateProduct
);
router.delete("/admin/products/:id", verifyToken, productCtrl.deleteProduct);

module.exports = router;
