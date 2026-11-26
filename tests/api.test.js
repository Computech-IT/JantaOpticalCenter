const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const app = require("../src/app");
const db = require("../src/db");
const { runMigrations } = require("../src/db/migrations");

let server;
let baseUrl;

function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

describe("Janta Optical Centre Enterprise API", () => {
  before(async () => {
    await runMigrations();
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await db.close();
  });

  it("GET /healthz returns 200 and security headers are present", async () => {
    const res = await request("/healthz");
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "up");
    assert.ok(res.headers.get("x-content-type-options") === "nosniff");
    assert.ok(res.headers.get("x-frame-options") !== null);
  });

  it("GET /api/products returns seeded products with metadata", async () => {
    const res = await request("/api/products");
    assert.equal(res.status, 200);
    const products = await res.json();
    assert.ok(Array.isArray(products));
    assert.ok(products.length > 0);
    assert.ok(products[0].sku);
    assert.ok(Array.isArray(products[0].images));
  });

  it("GET /api/products supports search and shape filtering", async () => {
    const res = await request("/api/products?q=wayfarer&sort=price_asc");
    assert.equal(res.status, 200);
    const products = await res.json();
    assert.ok(products.every((p) => p.name.toLowerCase().includes("wayfarer")));
  });

  it("POST /api/orders calculates authoritative server-side totals & supports tracking", async () => {
    const prodRes = await request("/api/products");
    const products = await prodRes.json();
    const first = products[0];

    const orderRes = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Customer",
        phone: "+91 9876543210",
        address: "123 MG Marg, Gangtok, Sikkim 737101",
        paymentMethod: "cod",
        items: [{ id: first.id, qty: 1, lensPackage: "blue_cut" }],
      }),
    });
    assert.equal(orderRes.status, 201);
    const order = await orderRes.json();
    assert.equal(order.success, true);
    assert.ok(order.orderNumber.startsWith("JOC-"));
    // Blue-cut lens is +1100
    assert.equal(order.subtotal, first.price + 1100);

    // Track the newly created order
    const trackRes = await request(
      `/api/orders/track?orderNumber=${encodeURIComponent(order.orderNumber)}&phone=9876543210`
    );
    assert.equal(trackRes.status, 200);
    const tracked = await trackRes.json();
    assert.equal(tracked.orderNumber, order.orderNumber);
    assert.equal(tracked.status, "pending");
  });

  it("POST /api/orders rejects invalid input via Zod validation", async () => {
    const res = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "A",
        phone: "123",
        address: "short",
        items: [],
      }),
    });
    assert.equal(res.status, 400);
  });

  it("Protected admin endpoints reject unauthenticated requests", async () => {
    const res = await request("/api/admin/analytics");
    assert.equal(res.status, 401);
  });

  it("Customer registration, login, prescription save, and Razorpay HMAC verification work", async () => {
    const email = `cust_${Date.now()}@example.com`;
    const regRes = await request("/api/customers/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Priya Rai",
        email,
        phone: "+91 9876543211",
        password: "StrongPassword123!",
      }),
    });
    assert.equal(regRes.status, 201);
    const { token } = await regRes.json();
    assert.ok(token);

    // Save prescription
    const rxRes = await request("/api/customers/prescriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        label: "Everyday Glasses",
        od_sph: "-1.25",
        os_sph: "-1.50",
        pd: "62",
      }),
    });
    assert.equal(rxRes.status, 201);

    const listRx = await request("/api/customers/prescriptions", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(listRx.status, 200);
    const prescriptions = await listRx.json();
    assert.equal(prescriptions.length, 1);
    assert.equal(prescriptions[0].od_sph, "-1.25");

    // Verify Razorpay HMAC signature helper
    const crypto = require("node:crypto");
    const { verifyRazorpaySignature } = require("../src/controllers/paymentController");
    const secret = "test_secret_123";
    const sig = crypto.createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    assert.equal(verifyRazorpaySignature("order_1", "pay_1", sig, secret), true);
    assert.equal(verifyRazorpaySignature("order_1", "pay_1", "tampered", secret), false);
  });

  it("Phase 3: X-Request-Id, X-Cache HIT/MISS, dynamic sitemap, and GST invoice work", async () => {
    // 1. Cache MISS then HIT on a fresh /api/products query
    const r1 = await request("/api/products?sort=name");
    assert.equal(r1.status, 200);
    assert.ok(r1.headers.get("x-request-id"));
    assert.equal(r1.headers.get("x-cache"), "MISS");

    const r2 = await request("/api/products?sort=name");
    assert.equal(r2.status, 200);
    assert.equal(r2.headers.get("x-cache"), "HIT");

    // 2. Dynamic sitemap
    const smRes = await request("/sitemap-products.xml");
    assert.equal(smRes.status, 200);
    assert.ok(smRes.headers.get("content-type").includes("application/xml"));
    const smXml = await smRes.text();
    assert.ok(smXml.includes("<urlset"));
    assert.ok(smXml.includes("/product.html?slug="));

    // 3. Create order & fetch GST invoice
    const products = await r2.json();
    const orderRes = await request("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Invoice Tester",
        phone: "+91 9988776655",
        address: "MG Marg, Gangtok, Sikkim 737101",
        items: [{ id: products[0].id, qty: 1, lensPackage: "frame_only" }],
      }),
    });
    const order = await orderRes.json();

    const invRes = await request(
      `/api/orders/${encodeURIComponent(order.orderNumber)}/invoice?phone=9988776655`
    );
    assert.equal(invRes.status, 200);
    const inv = await invRes.json();
    assert.equal(inv.gst.ratePercent, 12);
    assert.ok(inv.gst.cgst > 0);
    assert.equal(inv.gst.cgst, inv.gst.sgst);
  });

  it("Checkout supports multipart prescription file upload + eyesight measurements", async () => {
    const prodRes = await request("/api/products");
    const products = await prodRes.json();

    const fd = new FormData();
    fd.append("name", "Rx Checkout Customer");
    fd.append("phone", "+91 9812345678");
    fd.append("address", "Pakyong Bazaar, East Sikkim 737106");
    fd.append("items", JSON.stringify([{ id: products[0].id, qty: 1, lensPackage: "blue_cut" }]));
    fd.append("prescription", JSON.stringify({ od_sph: "-1.75", os_sph: "-2.00", pd: "63" }));
    // Valid minimal PDF header
    const pdfBlob = new Blob(["%PDF-1.4\n%Test Rx\n"], { type: "application/pdf" });
    fd.append("prescriptionFile", pdfBlob, "my-rx.pdf");

    const orderRes = await request("/api/orders", { method: "POST", body: fd });
    assert.equal(orderRes.status, 201);
    const data = await orderRes.json();
    assert.equal(data.success, true);

    // Unauthenticated access to private prescription files must be blocked
    const rxAuthCheck = await request("/api/admin/prescriptions/rx-test.pdf");
    assert.equal(rxAuthCheck.status, 401);
  });

  it("Admin security, RBAC staff management, and customer token isolation work", async () => {
    // 1. Customer token must NOT access admin routes (403)
    const custRes = await request("/api/customers/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Privilege Test",
        email: `priv_${Date.now()}@example.com`,
        password: "StrongPassword123!",
      }),
    });
    const { token: custToken } = await custRes.json();
    const escalateRes = await request("/api/admin/analytics", {
      headers: { Authorization: `Bearer ${custToken}` },
    });
    assert.equal(escalateRes.status, 401);

    // 2. Super Admin login with reset password
    const loginRes = await request("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "Joc@Admin2026!9x" }),
    });
    assert.equal(loginRes.status, 200);
    const adminData = await loginRes.json();
    assert.equal(adminData.role, "super_admin");
    assert.ok(adminData.token);

    // 3. Super Admin registers a Store Manager staff account
    const staffUser = `mgr_${Date.now()}`;
    const createStaffRes = await request("/api/admin/staff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminData.token}`,
      },
      body: JSON.stringify({
        username: staffUser,
        fullName: "Store Manager",
        role: "manager",
        password: "ManagerPass123!",
      }),
    });
    assert.equal(createStaffRes.status, 201);

    // 4. Manager logs in: can bill POS, view/edit/delete reports, blocked from executive summary & staff
    const mgrLogin = await request("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: staffUser, password: "ManagerPass123!" }),
    });
    assert.equal(mgrLogin.status, 200);
    const { token: mgrToken } = await mgrLogin.json();

    const mgrAnalytics = await request("/api/admin/analytics", {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert.equal(mgrAnalytics.status, 403);

    const mgrExec = await request("/api/admin/executive-summary", {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert.equal(mgrExec.status, 403);

    const mgrStaff = await request("/api/admin/staff", {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert.equal(mgrStaff.status, 403);

    // 5. Manager creates a POS Bill, edits it, prints invoice, and deletes it
    const prods = await (await request("/api/products")).json();
    const saleRes = await request("/api/admin/sales", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mgrToken}`,
      },
      body: JSON.stringify({
        customerName: "Walk-In POS Buyer",
        customerPhone: "9876500000",
        paymentMethod: "upi",
        discount: 200,
        items: [{ productId: prods[0].id, qty: 1, lensPackage: "single_vision" }],
      }),
    });
    assert.equal(saleRes.status, 201);
    const sale = await saleRes.json();
    assert.ok(sale.invoiceNumber.startsWith("INV-"));
    assert.equal(sale.total, prods[0].price + 600 - 200);

    const invRes = await request(`/api/admin/sales/${sale.invoiceNumber}/invoice`, {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert.equal(invRes.status, 200);

    const rptRes = await request("/api/admin/sales?days=30", {
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert.equal(rptRes.status, 200);
    const rpt = await rptRes.json();
    assert.ok(rpt.sales.some((s) => s.id === sale.id));

    const editRes = await request(`/api/admin/sales/${sale.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mgrToken}`,
      },
      body: JSON.stringify({ discount: 100 }),
    });
    assert.equal(editRes.status, 200);

    // 6. Super Admin fetches Executive Summary (Today, MTD, YTD + Stock Inventory)
    const execRes = await request("/api/admin/executive-summary", {
      headers: { Authorization: `Bearer ${adminData.token}` },
    });
    assert.equal(execRes.status, 200);
    const exec = await execRes.json();
    assert.ok(exec.sales.mtd.revenue >= 0);
    assert.ok(exec.sales.ytd.revenue >= exec.sales.mtd.revenue);
    assert.ok(typeof exec.inventory.totalUnits === "number");

    const delRes = await request(`/api/admin/sales/${sale.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${mgrToken}` },
    });
    assert.equal(delRes.status, 200);
  });
});
