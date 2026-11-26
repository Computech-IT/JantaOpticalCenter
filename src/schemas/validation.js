const { z } = require("zod");

const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required").max(50),
  password: z.string().min(1, "Password is required").max(128),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128),
});

const productBodySchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters").max(200),
  price: z.coerce.number().int().min(1, "Price must be at least ₹1").max(500000),
  description: z.string().trim().max(4000).optional().default(""),
  category: z
    .enum(["eyeglasses", "sunglasses", "blue-cut", "kids", "accessories"])
    .optional()
    .default("eyeglasses"),
  shape: z
    .enum(["aviator", "wayfarer", "round", "square", "cat-eye", "rimless", "geometric"])
    .optional()
    .default("wayfarer"),
  gender: z.enum(["men", "women", "kids", "unisex"]).optional().default("unisex"),
  frame_material: z.string().trim().max(64).optional().default("Acetate"),
  frame_size: z.enum(["Small", "Medium", "Large"]).optional().default("Medium"),
  stock: z.coerce.number().int().min(0).max(10000).optional().default(25),
});

const LENS_PACKAGES = {
  frame_only: { label: "Frame Only", price: 0 },
  single_vision: { label: "Single Vision Anti-Glare", price: 600 },
  blue_cut: { label: "Blue-Cut Computer Protection", price: 1100 },
  progressive: { label: "Progressive Multifocal", price: 2400 },
};

const orderItemSchema = z.object({
  id: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().min(1).max(20),
  lensPackage: z
    .enum(["frame_only", "single_vision", "blue_cut", "progressive"])
    .optional()
    .default("frame_only"),
});

const createOrderSchema = z.object({
  name: z.string().trim().min(2, "Full name is required").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s()-]{8,22}$/, "Please enter a valid phone number"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  address: z.string().trim().min(8, "Please provide a complete delivery address").max(500),
  notes: z.string().trim().max(1000).optional().default(""),
  paymentMethod: z.enum(["cod", "whatsapp", "upi", "razorpay"]).optional().default("cod"),
  prescription: z
    .object({
      od_sph: z.string().max(16).optional(),
      od_cyl: z.string().max(16).optional(),
      od_axis: z.string().max(16).optional(),
      os_sph: z.string().max(16).optional(),
      os_cyl: z.string().max(16).optional(),
      os_axis: z.string().max(16).optional(),
      pd: z.string().max(16).optional(),
    })
    .optional(),
  items: z.array(orderItemSchema).min(1, "Cart cannot be empty").max(30),
});

const customerRegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().email("Please enter a valid email address"),
  phone: z.string().trim().regex(/^[+\d\s-]{8,20}$/, "Please enter a valid phone number").optional().or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const customerLoginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const prescriptionSchema = z.object({
  label: z.string().trim().max(100).optional().default("My Prescription"),
  od_sph: z.string().trim().max(16).optional().default(""),
  od_cyl: z.string().trim().max(16).optional().default(""),
  od_axis: z.string().trim().max(16).optional().default(""),
  os_sph: z.string().trim().max(16).optional().default(""),
  os_cyl: z.string().trim().max(16).optional().default(""),
  os_axis: z.string().trim().max(16).optional().default(""),
  pd: z.string().trim().max(16).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

const razorpayOrderSchema = z.object({
  orderNumber: z.string().trim().min(4).max(64),
});

const razorpayVerifySchema = z.object({
  orderNumber: z.string().trim().min(4).max(64),
  razorpay_order_id: z.string().min(4),
  razorpay_payment_id: z.string().min(4),
  razorpay_signature: z.string().min(10),
});

const updateOrderStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"]),
});

const createStaffSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username can only contain letters, numbers, dots, underscores, and hyphens"),
  fullName: z.string().trim().min(2, "Full name is required").max(120),
  email: z.string().trim().email("Valid email required").optional().or(z.literal("")),
  role: z.enum(["super_admin", "manager", "optometrist"]).default("manager"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const updateStaffStatusSchema = z.object({
  isActive: z.boolean(),
});

const saleItemSchema = z.object({
  productId: z.coerce.number().int().positive().optional().nullable(),
  name: z.string().trim().min(1).max(200).optional(),
  unitPrice: z.coerce.number().min(0).max(500000).optional(),
  qty: z.coerce.number().int().min(1).max(50).default(1),
  lensPackage: z
    .enum(["frame_only", "single_vision", "blue_cut", "progressive"])
    .optional()
    .default("frame_only"),
});

const createSaleSchema = z.object({
  customerName: z.string().trim().min(2, "Customer name is required").max(120),
  customerPhone: z.string().trim().max(22).optional().default(""),
  discount: z.coerce.number().min(0).max(500000).optional().default(0),
  paymentMethod: z.enum(["cash", "upi", "card"]).optional().default("cash"),
  notes: z.string().trim().max(1000).optional().default(""),
  prescription: z
    .object({
      od_sph: z.string().max(16).optional(),
      od_cyl: z.string().max(16).optional(),
      od_axis: z.string().max(16).optional(),
      os_sph: z.string().max(16).optional(),
      os_cyl: z.string().max(16).optional(),
      os_axis: z.string().max(16).optional(),
      pd: z.string().max(16).optional(),
    })
    .optional(),
  items: z.array(saleItemSchema).min(1, "Add at least one item to bill").max(30),
});

const updateSaleSchema = z.object({
  customerName: z.string().trim().min(2).max(120).optional(),
  customerPhone: z.string().trim().max(22).optional(),
  discount: z.coerce.number().min(0).max(500000).optional(),
  paymentMethod: z.enum(["cash", "upi", "card"]).optional(),
  notes: z.string().trim().max(1000).optional(),
});

module.exports = {
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
};
