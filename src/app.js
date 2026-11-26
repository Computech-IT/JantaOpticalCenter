const express = require("express");
const path = require("path");
const {
  helmetMiddleware,
  corsMiddleware,
  compressionMiddleware,
  apiLimiter,
} = require("./middleware/security");
const apiRoutes = require("./routes/api");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { requestLogger } = require("./middleware/logger");
const db = require("./db");

const app = express();

// Trust reverse proxy (Hostinger / Nginx / Cloudflare) for accurate rate-limiting IP
app.set("trust proxy", 1);

// Global security, logging & performance middleware
app.use(requestLogger);
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(compressionMiddleware);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Dynamic SEO Sitemap for live products
app.get("/sitemap-products.xml", async (req, res) => {
  try {
    const products = await db.query(
      "SELECT id, slug, created_at FROM products WHERE is_active IS NULL OR is_active = 1 ORDER BY id DESC"
    );
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const urls = products
      .map((p) => {
        const loc = `${baseUrl}/product.html?slug=${encodeURIComponent(p.slug || p.id)}`;
        const lastmod = p.created_at ? String(p.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10);
        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      })
      .join("\n");

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  } catch (err) {
    res.status(500).send("Unable to generate sitemap");
  }
});

// Healthz probe outside rate limit
app.get("/healthz", async (req, res) => {
  const dbStatus = await db.healthCheck();
  res.status(dbStatus.status === "up" ? 200 : 503).json({ status: dbStatus.status });
});

// Static assets with smart caching
app.use(
  express.static(path.join(process.cwd(), "public"), {
    maxAge: "1d",
    etag: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// API Routes
app.use("/api", apiLimiter, apiRoutes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
