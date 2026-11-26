const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const uploadDir = path.join(process.cwd(), "public", "images", "products");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const prescriptionDir = path.join(process.cwd(), "data", "prescriptions");
if (!fs.existsSync(prescriptionDir)) {
  fs.mkdirSync(prescriptionDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
    cb(null, `${uuidv4()}${safeExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only JPEG, PNG, and WebP images are allowed"), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024, files: 4 },
});

// Verify actual file magic bytes after upload to prevent MIME spoofing
function hasValidImageMagicBytes(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
    // WEBP: RIFF....WEBP
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return true;

    return false;
  } catch {
    return false;
  }
}

function verifyUploadedImages(req, res, next) {
  if (!req.files || req.files.length === 0) return next();

  const invalid = [];
  for (const file of req.files) {
    if (!hasValidImageMagicBytes(file.path)) {
      invalid.push(file.path);
    }
  }

  if (invalid.length > 0) {
    // Clean up all uploaded files from this request
    for (const file of req.files) {
      try {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      } catch {}
    }
    return res.status(400).json({ error: "Invalid image file content detected." });
  }
  next();
}

function deleteProductImages(imgField) {
  if (!imgField) return;
  const list = parseImageField(imgField);
  for (const img of list) {
    // Prevent path traversal
    const safeName = path.basename(img);
    const filePath = path.join(uploadDir, safeName);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
      console.error("[Upload] Failed to delete image:", safeName, err.message);
    }
  }
}

function parseImageField(imgField) {
  if (!imgField) return [];
  if (Array.isArray(imgField)) return imgField.filter(Boolean);
  const trimmed = String(imgField).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return trimmed
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = {
  upload,
  uploadDir,
  prescriptionDir,
  prescriptionUpload: multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, prescriptionDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".pdf"].includes(ext) ? ext : ".jpg";
        cb(null, `rx-${uuidv4()}${safeExt}`);
      },
    }),
    fileFilter: (_req, file, cb) => {
      const allowed = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/pdf",
        "application/x-pdf",
      ];
      const ext = path.extname(file.originalname || "").toLowerCase();
      if (!allowed.includes(file.mimetype) && ext !== ".pdf") {
        return cb(new Error("Prescription must be a JPEG, PNG, WebP image or PDF"), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  }),
  verifyUploadedPrescription: (req, res, next) => {
    if (!req.file) return next();
    const filePath = req.file.path;
    try {
      const fd = fs.openSync(filePath, "r");
      const buf = Buffer.alloc(128);
      const bytesRead = fs.readSync(fd, buf, 0, 128, 0);
      fs.closeSync(fd);
      const headerStr = buf.toString("latin1", 0, bytesRead);
      const isPdf = headerStr.includes("%PDF");
      if (!isPdf && !hasValidImageMagicBytes(filePath)) {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: "Invalid prescription file content. Please upload a valid JPG, PNG, WebP, or PDF." });
      }
      next();
    } catch {
      return res.status(400).json({ error: "Could not read uploaded prescription." });
    }
  },
  verifyUploadedImages,
  deleteProductImages,
  parseImageField,
};
