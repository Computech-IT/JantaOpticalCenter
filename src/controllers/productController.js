const db = require("../db");
const { deleteProductImages, parseImageField } = require("../middleware/upload");
const { productCache } = require("../utils/cache");

function formatProduct(row) {
  return {
    id: row.id,
    sku: row.sku || `JOC-${String(row.id).padStart(4, "0")}`,
    slug: row.slug || `product-${row.id}`,
    name: row.name,
    price: Number(row.price),
    description: row.description || "",
    category: row.category || "eyeglasses",
    shape: row.shape || "wayfarer",
    gender: row.gender || "unisex",
    frame_material: row.frame_material || "Acetate",
    frame_size: row.frame_size || "Medium",
    stock: row.stock ?? 25,
    images: parseImageField(row.img),
  };
}

function makeSlug(name, idHint = "") {
  const base = String(name || "eyewear")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return idHint ? `${base}-${idHint}` : `${base}-${Date.now().toString(36)}`;
}

async function listProducts(req, res, next) {
  try {
    const cacheKey = `list:${req.originalUrl}`;
    const cached = productCache.get(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const { q, category, shape, gender, minPrice, maxPrice, sort } = req.query;

    const conditions = ["(is_active IS NULL OR is_active = 1)"];
    const params = [];

    if (q && String(q).trim()) {
      const term = `%${String(q).trim().toLowerCase()}%`;
      conditions.push("(LOWER(name) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?)");
      params.push(term, term);
    }
    if (category && category !== "all") {
      conditions.push("category = ?");
      params.push(String(category));
    }
    if (shape && shape !== "all") {
      conditions.push("shape = ?");
      params.push(String(shape));
    }
    if (gender && gender !== "all") {
      conditions.push("(gender = ? OR gender = 'unisex')");
      params.push(String(gender));
    }
    if (minPrice !== undefined && minPrice !== "" && !isNaN(Number(minPrice))) {
      conditions.push("price >= ?");
      params.push(Number(minPrice));
    }
    if (maxPrice !== undefined && maxPrice !== "" && !isNaN(Number(maxPrice))) {
      conditions.push("price <= ?");
      params.push(Number(maxPrice));
    }

    let orderBy = "id DESC";
    if (sort === "price_asc") orderBy = "price ASC, id DESC";
    else if (sort === "price_desc") orderBy = "price DESC, id DESC";
    else if (sort === "name") orderBy = "name ASC";

    const sql = `SELECT * FROM products WHERE ${conditions.join(" AND ")} ORDER BY ${orderBy}`;
    const rows = await db.query(sql, params);
    const formatted = rows.map(formatProduct);
    productCache.set(`list:${req.originalUrl}`, formatted);
    res.setHeader("X-Cache", "MISS");
    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const param = req.params.idOrSlug;
    const cacheKey = `item:${param}`;
    const cached = productCache.get(cacheKey);
    if (cached) {
      res.setHeader("X-Cache", "HIT");
      return res.json(cached);
    }

    const isNumeric = /^\d+$/.test(param);
    const row = isNumeric
      ? await db.getOne("SELECT * FROM products WHERE id = ?", [Number(param)])
      : await db.getOne("SELECT * FROM products WHERE slug = ?", [param]);

    if (!row) return res.status(404).json({ error: "Product not found" });
    const formatted = formatProduct(row);
    productCache.set(cacheKey, formatted);
    res.setHeader("X-Cache", "MISS");
    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const { name, price, description, category, shape, gender, frame_material, frame_size, stock } =
      req.body;
    const filenames = req.files ? req.files.map((f) => f.filename).join(",") : "";
    const now = new Date().toISOString();

    const result = await db.execute(
      `INSERT INTO products (name, price, description, img, category, shape, gender, frame_material, frame_size, stock, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      [name, price, description, filenames, category, shape, gender, frame_material, frame_size, stock, now]
    );

    const id = result.insertId;
    const slug = makeSlug(name, id);
    const sku = `JOC-${String(id).padStart(4, "0")}`;
    await db.execute("UPDATE products SET slug = ?, sku = ? WHERE id = ?", [slug, sku, id]);

    const created = await db.getOne("SELECT * FROM products WHERE id = ?", [id]);
    productCache.clear();
    res.status(201).json({ success: true, id, product: formatProduct(created) });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });

    const existing = await db.getOne("SELECT * FROM products WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    const { name, price, description, category, shape, gender, frame_material, frame_size, stock } =
      req.body;

    let newImages = existing.img || "";
    if (req.files && req.files.length > 0) {
      deleteProductImages(existing.img);
      newImages = req.files.map((f) => f.filename).join(",");
    }

    await db.execute(
      `UPDATE products
       SET name = ?, price = ?, description = ?, img = ?, category = ?, shape = ?, gender = ?, frame_material = ?, frame_size = ?, stock = ?
       WHERE id = ?`,
      [name, price, description, newImages, category, shape, gender, frame_material, frame_size, stock, id]
    );

    const updated = await db.getOne("SELECT * FROM products WHERE id = ?", [id]);
    productCache.clear();
    res.json({ success: true, product: formatProduct(updated) });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });

    const existing = await db.getOne("SELECT * FROM products WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    deleteProductImages(existing.img);
    await db.execute("DELETE FROM products WHERE id = ?", [id]);
    productCache.clear();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
};
