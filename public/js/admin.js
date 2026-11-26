document.addEventListener("DOMContentLoaded", () => {
  let token = localStorage.getItem("admin_token");
  let username = localStorage.getItem("admin_username");
  let currentRole = localStorage.getItem("admin_role") || "super_admin";
  let allProducts = [];
  let selectedFiles = [];

  const loginSection = document.getElementById("login-section");
  const dashboardSection = document.getElementById("dashboard-section");
  const loginForm = document.getElementById("login-form");
  const logoutBtn = document.getElementById("logout-btn");

  const productGrid = document.getElementById("products-grid");
  const productModal = document.getElementById("product-modal");
  const productForm = document.getElementById("product-form");
  const openAddBtn = document.getElementById("open-add-modal-btn");
  const closeModalBtns = document.querySelectorAll(".close-modal");

  const productId = document.getElementById("product-id");
  const productName = document.getElementById("product-name");
  const productPrice = document.getElementById("product-price");
  const productDesc = document.getElementById("product-desc");
  const productCategory = document.getElementById("product-category");
  const productShape = document.getElementById("product-shape");
  const productGender = document.getElementById("product-gender");
  const productStock = document.getElementById("product-stock");

  const uploadZone = document.getElementById("upload-zone");
  const imageInput = document.getElementById("product-images-input");
  const imagePreview = document.getElementById("image-preview-container");
  const searchInput = document.getElementById("search-product");
  const changePasswordForm = document.getElementById("change-password-form");

  const sidebarItems = document.querySelectorAll(".sidebar-nav .nav-item");
  const navAnalytics = document.getElementById("nav-analytics");
  const navStaff = document.getElementById("nav-staff");
  const sections = {
    products: document.getElementById("section-products"),
    analytics: document.getElementById("section-analytics"),
    billing: document.getElementById("section-billing"),
    reports: document.getElementById("section-reports"),
    staff: document.getElementById("section-staff"),
    settings: document.getElementById("section-settings"),
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  function authHeaders(extra = {}) {
    return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
  }

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: authHeaders(options.headers || {}),
    });
    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      token = null;
      showLogin();
      showToast("Session expired. Please login again.", "error");
    }
    return res;
  }

  function showLogin() {
    loginSection?.classList.remove("hidden");
    dashboardSection?.classList.add("hidden");
  }

  async function showDashboard() {
    loginSection?.classList.add("hidden");
    dashboardSection?.classList.remove("hidden");
    loadProducts();

    try {
      const meRes = await apiFetch("/api/admin/me");
      if (meRes.status === 401 || meRes.status === 403) {
        localStorage.removeItem("admin_token");
        token = null;
        showLogin();
        return;
      }
      if (meRes.ok) {
        const me = await meRes.json();
        username = me.fullName || me.username;
        currentRole = me.role || "super_admin";
        localStorage.setItem("admin_username", username);
        localStorage.setItem("admin_role", currentRole);
      }
    } catch {}

    const nameEl = document.getElementById("display-username");
    const roleEl = document.getElementById("display-role");
    if (nameEl && username) nameEl.textContent = username;
    if (roleEl) roleEl.textContent = currentRole.replace("_", " ").toUpperCase();

    const isSuperAdmin = currentRole === "super_admin";
    if (navStaff) navStaff.classList.toggle("hidden", !isSuperAdmin);
    if (navAnalytics) navAnalytics.classList.toggle("hidden", !isSuperAdmin);

    // Land Super Admin on Executive Dashboard; Staff directly on Billing / POS
    activateTab(isSuperAdmin ? "nav-analytics" : "nav-billing");
  }

  function activateTab(navId) {
    sidebarItems.forEach((i) => i.classList.toggle("active", i.id === navId));
    Object.values(sections).forEach((sec) => sec?.classList.add("hidden"));
    if (navId === "nav-products") sections.products?.classList.remove("hidden");
    else if (navId === "nav-analytics") {
      sections.analytics?.classList.remove("hidden");
      loadAnalytics();
    } else if (navId === "nav-billing") {
      sections.billing?.classList.remove("hidden");
      populatePosProducts();
    } else if (navId === "nav-reports") {
      sections.reports?.classList.remove("hidden");
      loadReports();
    } else if (navId === "nav-staff") {
      sections.staff?.classList.remove("hidden");
      loadStaff();
    } else if (navId === "nav-settings") {
      sections.settings?.classList.remove("hidden");
    }
  }

  token ? showDashboard() : showLogin();

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById("username").value.trim();
    const passwordInput = document.getElementById("password").value;

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Login failed", "error");
        return;
      }

      token = data.token;
      username = data.fullName || data.username;
      currentRole = data.role || "super_admin";
      localStorage.setItem("admin_token", token);
      localStorage.setItem("admin_username", username);
      localStorage.setItem("admin_role", currentRole);
      showToast("Login successful");
      showDashboard();
    } catch {
      showToast("Server error", "error");
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    } catch {}
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_username");
    token = null;
    showLogin();
  });

  // Sidebar / Topbar Navigation
  sidebarItems.forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      activateTab(item.id);
    });
  });

  // Executive Summary + Analytics & Orders Management
  async function loadAnalytics() {
    try {
      const [res, execRes] = await Promise.all([
        apiFetch("/api/admin/analytics"),
        apiFetch("/api/admin/executive-summary"),
      ]);
      if (execRes.ok) {
        const exec = await execRes.json();
        const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
        document.getElementById("stat-today-rev").textContent = fmt(exec.sales?.today?.revenue);
        document.getElementById("stat-today-cnt").textContent = `${exec.sales?.today?.count || 0} bills/orders`;
        document.getElementById("stat-mtd-rev").textContent = fmt(exec.sales?.mtd?.revenue);
        document.getElementById("stat-mtd-cnt").textContent = `${exec.sales?.mtd?.count || 0} this month`;
        document.getElementById("stat-ytd-rev").textContent = fmt(exec.sales?.ytd?.revenue);
        document.getElementById("stat-ytd-cnt").textContent = `${exec.sales?.ytd?.count || 0} this year`;
        document.getElementById("stat-stock-units").textContent = exec.inventory?.totalUnits ?? 0;
        document.getElementById("stat-stock-skus").textContent = `${exec.inventory?.totalSkus || 0} SKUs`;

        const lowPanel = document.getElementById("low-stock-panel");
        const lowList = document.getElementById("low-stock-list");
        const lowItems = exec.inventory?.lowStockItems || [];
        if (lowPanel && lowList) {
          if (lowItems.length > 0) {
            lowPanel.classList.remove("hidden");
            lowList.innerHTML = lowItems
              .map(
                (it) => `
              <div class="low-stock-card">
                <div>
                  <strong>${escapeHtml(it.name)}</strong>
                  <small>${escapeHtml(it.sku || "")} • ₹${Number(it.price).toLocaleString("en-IN")}</small>
                </div>
                <span class="low-stock-qty">${Number(it.stock)} left</span>
              </div>
            `
              )
              .join("");
          } else {
            lowPanel.classList.add("hidden");
          }
        }
      }

      if (!res.ok) return;
      const data = await res.json();

      document.getElementById("stat-orders").textContent = data.totalOrders ?? 0;
      document.getElementById("stat-revenue").textContent = `₹${Number(data.totalRevenue || 0).toLocaleString("en-IN")}`;
      document.getElementById("stat-products").textContent = data.totalProducts ?? 0;
      const pendingEl = document.getElementById("stat-pending");
      if (pendingEl) pendingEl.textContent = data.pendingOrders ?? 0;

      const ordersList = document.getElementById("orders-list");
      if (!ordersList) return;

      if (!data.recentOrders || data.recentOrders.length === 0) {
        ordersList.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">No orders yet.</td></tr>';
        return;
      }

      ordersList.innerHTML = data.recentOrders
        .map((o) => {
          const itemsSummary = (o.items || [])
            .map((it) => `${escapeHtml(it.name)} (${escapeHtml(it.lensLabel || "Frame")}) × ${Number(it.qty || 1)}`)
            .join(", ");
          const rx = o.prescription;
          const rxText = rx
            ? `<div style="margin-top:4px;font-size:0.75rem;color:#38bdf8;">OD: ${escapeHtml(rx.od_sph || "-")} / ${escapeHtml(rx.od_cyl || "-")} × ${escapeHtml(rx.od_axis || "-")} | OS: ${escapeHtml(rx.os_sph || "-")} / ${escapeHtml(rx.os_cyl || "-")} × ${escapeHtml(rx.os_axis || "-")} | PD: ${escapeHtml(rx.pd || "-")}</div>`
            : "";
          const rxFileLink = o.prescriptionFile
            ? `<div style="margin-top:4px;"><a href="/api/admin/prescriptions/${encodeURIComponent(o.prescriptionFile)}" target="_blank" rel="noopener" style="color:#a5b4fc;font-size:0.75rem;text-decoration:underline;">View Uploaded Rx</a></div>`
            : "";
          const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : "-";
          const statuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
          return `
            <tr>
              <td><strong>${escapeHtml(o.orderNumber)}</strong></td>
              <td>${escapeHtml(o.customerName)}<br><small style="color:#94a3b8">${escapeHtml(o.phone || "")}</small></td>
              <td>₹${Number(o.total || 0).toLocaleString("en-IN")}</td>
              <td>
                <select class="order-status-select" data-order-id="${Number(o.id)}" style="background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;padding:4px 8px;">
                  ${statuses
                    .map(
                      (s) =>
                        `<option value="${s}" ${o.status === s ? "selected" : ""}>${s.toUpperCase()}</option>`
                    )
                    .join("")}
                </select>
              </td>
              <td>${escapeHtml(dateStr)}</td>
              <td style="max-width:260px;font-size:0.85rem;">${itemsSummary || "-"}${rxText}${rxFileLink}</td>
              <td>
                ${
                  o.orderNumber && o.phone
                    ? `<a class="btn-invoice-link" href="/invoice.html?orderNumber=${encodeURIComponent(o.orderNumber)}&phone=${encodeURIComponent(o.phone)}" target="_blank" rel="noopener"><i class="fa-solid fa-file-invoice"></i> Invoice</a>`
                    : "-"
                }
              </td>
            </tr>
          `;
        })
        .join("");

      ordersList.querySelectorAll(".order-status-select").forEach((sel) => {
        sel.addEventListener("change", async () => {
          const id = sel.dataset.orderId;
          const status = sel.value;
          const r = await apiFetch(`/api/admin/orders/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          });
          if (r.ok) showToast(`Order updated to ${status}`);
          else showToast("Failed to update status", "error");
        });
      });
    } catch {
      showToast("Failed to load analytics", "error");
    }
  }

  // POS Billing Terminal
  const LENS_PRICES = {
    frame_only: { label: "Frame Only", price: 0 },
    single_vision: { label: "Single Vision Anti-Glare", price: 600 },
    blue_cut: { label: "Blue-Cut Computer", price: 1100 },
    progressive: { label: "Progressive Multifocal", price: 2400 },
  };
  let posCart = [];

  function populatePosProducts() {
    const sel = document.getElementById("pos-product");
    if (!sel) return;
    sel.innerHTML = allProducts
      .map(
        (p) =>
          `<option value="${Number(p.id)}">${escapeHtml(p.name)} — ₹${Number(p.price).toLocaleString("en-IN")} (Stock: ${Number(p.stock ?? 0)})</option>`
      )
      .join("");
  }

  function renderPosCart() {
    const listEl = document.getElementById("pos-items-list");
    const discount = Math.max(0, Number(document.getElementById("pos-discount")?.value || 0));
    let subtotal = 0;

    if (posCart.length === 0) {
      if (listEl) listEl.innerHTML = '<p style="color:#94a3b8;font-size:0.85rem;">No items added yet.</p>';
    } else if (listEl) {
      listEl.innerHTML = posCart
        .map((item, idx) => {
          const line = item.unitPrice * item.qty;
          subtotal += line;
          return `
            <div class="pos-item-row">
              <div>
                <strong>${escapeHtml(item.name)}</strong><br>
                <small style="color:#94a3b8">${escapeHtml(item.lensLabel)} × ${item.qty}</small>
              </div>
              <div style="display:flex;align-items:center;gap:10px;">
                <strong>₹${line.toLocaleString("en-IN")}</strong>
                <button type="button" data-pos-remove="${idx}" style="color:#f87171;background:none;border:none;cursor:pointer;font-weight:700;">✕</button>
              </div>
            </div>
          `;
        })
        .join("");

      listEl.querySelectorAll("[data-pos-remove]").forEach((btn) => {
        btn.addEventListener("click", () => {
          posCart.splice(Number(btn.dataset.posRemove), 1);
          renderPosCart();
        });
      });
    }

    const total = Math.max(0, subtotal - discount);
    document.getElementById("pos-subtotal").textContent = `₹${subtotal.toLocaleString("en-IN")}`;
    document.getElementById("pos-discount-display").textContent = `₹${Math.min(subtotal, discount).toLocaleString("en-IN")}`;
    document.getElementById("pos-total").textContent = `₹${total.toLocaleString("en-IN")}`;
  }

  document.getElementById("pos-discount")?.addEventListener("input", renderPosCart);
  document.getElementById("pos-add-item-btn")?.addEventListener("click", () => {
    const prodId = Number(document.getElementById("pos-product")?.value);
    const lensKey = document.getElementById("pos-lens")?.value || "frame_only";
    const qty = Math.max(1, Number(document.getElementById("pos-qty")?.value || 1));
    const prod = allProducts.find((p) => Number(p.id) === prodId);
    if (!prod) return showToast("Select a product first", "error");

    const lens = LENS_PRICES[lensKey] || LENS_PRICES.frame_only;
    posCart.push({
      productId: prod.id,
      name: prod.name,
      lensPackage: lensKey,
      lensLabel: lens.label,
      unitPrice: Number(prod.price) + lens.price,
      qty,
    });
    renderPosCart();
  });

  document.getElementById("pos-billing-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (posCart.length === 0) return showToast("Add at least one item to bill", "error");

    const od = document.getElementById("pos-od").value.trim();
    const os = document.getElementById("pos-os").value.trim();
    const payload = {
      customerName: document.getElementById("pos-cust-name").value.trim(),
      customerPhone: document.getElementById("pos-cust-phone").value.trim(),
      paymentMethod: document.getElementById("pos-payment").value,
      discount: Number(document.getElementById("pos-discount").value || 0),
      notes: document.getElementById("pos-notes").value.trim(),
      items: posCart.map((i) => ({ productId: i.productId, qty: i.qty, lensPackage: i.lensPackage })),
      ...(od || os ? { prescription: { od_sph: od, os_sph: os } } : {}),
    };

    const res = await apiFetch("/api/admin/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || "Billing failed", "error");

    showToast(`Bill ${data.invoiceNumber} generated!`);
    posCart = [];
    renderPosCart();
    e.target.reset();
    loadProducts();
    window.open(`/invoice.html?invoiceNumber=${encodeURIComponent(data.invoiceNumber)}`, "_blank", "noopener");
  });

  // Daily Sales Reports (Up to 30 Days Filter, Edit & Delete)
  let cachedSales = [];
  const editSaleModal = document.getElementById("edit-sale-modal");
  document.querySelectorAll(".close-sale-modal").forEach((b) => {
    b.addEventListener("click", () => {
      editSaleModal?.classList.remove("active");
      editSaleModal?.classList.add("hidden");
    });
  });

  async function loadReports() {
    const days = document.getElementById("report-days-filter")?.value || "30";
    const q = document.getElementById("report-search-input")?.value.trim() || "";
    const listEl = document.getElementById("reports-list");
    if (!listEl) return;

    const params = new URLSearchParams({ days });
    if (q) params.set("q", q);

    const res = await apiFetch(`/api/admin/sales?${params.toString()}`);
    if (!res.ok) return;
    const { summary, sales } = await res.json();
    cachedSales = sales || [];

    document.getElementById("report-count").textContent = summary.count ?? 0;
    document.getElementById("report-revenue").textContent = `₹${Number(summary.totalRevenue || 0).toLocaleString("en-IN")}`;
    document.getElementById("report-window").textContent = `${summary.days}d`;

    if (cachedSales.length === 0) {
      listEl.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#94a3b8;">No sales records found in this period.</td></tr>';
      return;
    }

    listEl.innerHTML = cachedSales
      .map((s) => {
        const itemsText = (s.items || []).map((i) => `${escapeHtml(i.name)} × ${i.qty}`).join(", ");
        const dateStr = s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN") : "-";
        return `
          <tr>
            <td><strong>${escapeHtml(s.invoiceNumber)}</strong></td>
            <td>${escapeHtml(s.customerName)}<br><small style="color:#94a3b8">${escapeHtml(s.customerPhone || "Walk-in")}</small></td>
            <td style="max-width:220px;font-size:0.82rem;">${itemsText || "-"}</td>
            <td><span class="role-pill">${escapeHtml(s.paymentMethod)}</span></td>
            <td><strong>₹${Number(s.total).toLocaleString("en-IN")}</strong></td>
            <td>${escapeHtml(dateStr)}</td>
            <td>
              <div class="report-actions">
                <a class="btn-invoice-link" href="/invoice.html?invoiceNumber=${encodeURIComponent(s.invoiceNumber)}" target="_blank" rel="noopener">Invoice</a>
                <button type="button" class="btn-invoice-link" data-edit-sale="${Number(s.id)}">Edit</button>
                <button type="button" class="btn-invoice-link" style="background:rgba(239,68,68,0.2);color:#fca5a5;" data-del-sale="${Number(s.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-edit-sale]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sale = cachedSales.find((x) => Number(x.id) === Number(btn.dataset.editSale));
        if (!sale) return;
        document.getElementById("edit-sale-id").value = sale.id;
        document.getElementById("edit-sale-name").value = sale.customerName;
        document.getElementById("edit-sale-phone").value = sale.customerPhone || "";
        document.getElementById("edit-sale-payment").value = sale.paymentMethod || "cash";
        document.getElementById("edit-sale-discount").value = sale.discount || 0;
        document.getElementById("edit-sale-notes").value = sale.notes || "";
        editSaleModal?.classList.remove("hidden");
        editSaleModal?.classList.add("active");
      });
    });

    listEl.querySelectorAll("[data-del-sale]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this sales record permanently?")) return;
        const r = await apiFetch(`/api/admin/sales/${btn.dataset.delSale}`, { method: "DELETE" });
        if (r.ok) {
          showToast("Sales record deleted");
          loadReports();
        } else {
          showToast("Delete failed", "error");
        }
      });
    });
  }

  document.getElementById("report-days-filter")?.addEventListener("change", loadReports);
  let rptTimer;
  document.getElementById("report-search-input")?.addEventListener("input", () => {
    clearTimeout(rptTimer);
    rptTimer = setTimeout(loadReports, 250);
  });

  document.getElementById("edit-sale-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("edit-sale-id").value;
    const res = await apiFetch(`/api/admin/sales/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: document.getElementById("edit-sale-name").value.trim(),
        customerPhone: document.getElementById("edit-sale-phone").value.trim(),
        paymentMethod: document.getElementById("edit-sale-payment").value,
        discount: Number(document.getElementById("edit-sale-discount").value || 0),
        notes: document.getElementById("edit-sale-notes").value.trim(),
      }),
    });
    if (!res.ok) return showToast("Update failed", "error");
    showToast("Sales record updated");
    editSaleModal?.classList.remove("active");
    editSaleModal?.classList.add("hidden");
    loadReports();
  });

  // Staff Management (Full-Width Directory + Modal)
  const staffModal = document.getElementById("staff-modal");
  document.getElementById("open-staff-modal-btn")?.addEventListener("click", () => {
    staffModal?.classList.remove("hidden");
    staffModal?.classList.add("active");
  });
  document.querySelectorAll(".close-staff-modal").forEach((btn) => {
    btn.addEventListener("click", () => {
      staffModal?.classList.remove("active");
      staffModal?.classList.add("hidden");
    });
  });

  async function loadStaff() {
    const staffList = document.getElementById("staff-list");
    if (!staffList) return;
    try {
      const res = await apiFetch("/api/admin/staff");
      if (!res.ok) return;
      const list = await res.json();

      const totalEl = document.getElementById("staff-kpi-total");
      const activeEl = document.getElementById("staff-kpi-active");
      const adminsEl = document.getElementById("staff-kpi-admins");
      if (totalEl) totalEl.textContent = list.length;
      if (activeEl) activeEl.textContent = list.filter((s) => s.isActive).length;
      if (adminsEl) adminsEl.textContent = list.filter((s) => s.role === "super_admin").length;

      staffList.innerHTML = list
        .map((s) => {
          const initials = String(s.fullName || s.username || "A")
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return `
          <tr>
            <td>
              <div class="staff-user-cell">
                <span class="staff-avatar-badge">${escapeHtml(initials)}</span>
                <div>
                  <strong>${escapeHtml(s.fullName)}</strong><br>
                  <small style="color:#94a3b8">@${escapeHtml(s.username)}</small>
                </div>
              </div>
            </td>
            <td style="color:#cbd5e1;font-size:0.85rem;">${escapeHtml(s.email || "—")}</td>
            <td><span class="role-pill">${escapeHtml(s.role.replace("_", " "))}</span></td>
            <td><span class="${s.isActive ? "status-pill-active" : "status-pill-inactive"}">${s.isActive ? "Active" : "Disabled"}</span></td>
            <td>${s.lastLoginAt ? escapeHtml(new Date(s.lastLoginAt).toLocaleDateString("en-IN")) : "Never"}</td>
            <td>
              <button type="button" class="btn-invoice-link" data-toggle-staff="${Number(s.id)}" data-active="${s.isActive ? "1" : "0"}">
                ${s.isActive ? "Disable" : "Enable"}
              </button>
            </td>
          </tr>
        `;
        })
        .join("");

      staffList.querySelectorAll("[data-toggle-staff]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = Number(btn.dataset.toggleStaff);
          const nextActive = btn.dataset.active !== "1";
          const r = await apiFetch(`/api/admin/staff/${id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isActive: nextActive }),
          });
          const d = await r.json();
          if (!r.ok) return showToast(d.error || "Action failed", "error");
          showToast(`Staff account ${nextActive ? "enabled" : "disabled"}`);
          loadStaff();
        });
      });
    } catch {
      showToast("Failed to load staff", "error");
    }
  }

  document.getElementById("create-staff-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      fullName: document.getElementById("staff-fullname").value.trim(),
      username: document.getElementById("staff-username").value.trim(),
      email: document.getElementById("staff-email").value.trim(),
      role: document.getElementById("staff-role").value,
      password: document.getElementById("staff-password").value,
    };
    try {
      const res = await apiFetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "Could not create staff", "error");
      showToast(`Staff '${data.staff.username}' created!`);
      e.target.reset();
      staffModal?.classList.remove("active");
      staffModal?.classList.add("hidden");
      loadStaff();
    } catch {
      showToast("Server error", "error");
    }
  });

  // Change Password
  changePasswordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById("current-password").value;
    const newPassword = document.getElementById("new-password").value;
    try {
      const res = await apiFetch("/api/admin/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Password update failed", "error");
        return;
      }
      showToast("Password updated successfully!");
      changePasswordForm.reset();
    } catch {
      showToast("Server error", "error");
    }
  });

  // Image Compression
  async function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const maxDim = 1200;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d").drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              resolve(new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() }));
            },
            "image/jpeg",
            0.78
          );
        };
      };
    });
  }

  // Load & Render Products
  async function loadProducts() {
    if (!productGrid) return;
    productGrid.innerHTML = "Loading...";
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      allProducts = Array.isArray(data) ? data : [];
      renderProducts(allProducts);
    } catch {
      showToast("Failed to load products", "error");
    }
  }

  function renderProducts(products) {
    if (!products.length) {
      productGrid.innerHTML = "<p style='color:#94a3b8'>No products found.</p>";
      return;
    }
    productGrid.innerHTML = products
      .map((p) => {
        const imageUrl = p.images?.[0] ? `/images/products/${encodeURIComponent(p.images[0])}` : null;
        return `
          <div class="product-card" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;">
            <div style="width: 100%; height: 160px; background: #1e293b; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
              ${imageUrl ? `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="${escapeHtml(p.name)}" />` : '<i class="fa-solid fa-image" style="font-size: 2.5rem; color: #6366f1;"></i>'}
            </div>
            <div style="padding: 1rem; flex-grow: 1; display: flex; flex-direction: column;">
              <small style="color:#94a3b8;font-size:0.75rem;">${escapeHtml(p.sku || "")} • Stock: ${Number(p.stock ?? 25)}</small>
              <h4 style="font-size: 0.95rem; font-weight: 600; margin: 4px 0 0.5rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f8fafc;">${escapeHtml(p.name)}</h4>
              <p style="font-size: 1.2rem; font-weight: 700; color: #6366f1; margin: 0 0 1rem 0;">₹${Number(p.price).toLocaleString("en-IN")}</p>
              <div style="display: flex; gap: 0.5rem; margin-top: auto;">
                <button type="button" data-edit-id="${Number(p.id)}" style="flex: 1; padding: 0.5rem; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 0.85rem;">Edit</button>
                <button type="button" data-delete-id="${Number(p.id)}" style="flex: 1; padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 0.85rem;">Delete</button>
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  productGrid?.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-id]");
    if (editBtn) return editProduct(Number(editBtn.dataset.editId));
    const delBtn = e.target.closest("[data-delete-id]");
    if (delBtn) return deleteProduct(Number(delBtn.dataset.deleteId));
  });

  // Modal Controls
  openAddBtn?.addEventListener("click", () => {
    productForm.reset();
    productId.value = "";
    if (productStock) productStock.value = "25";
    selectedFiles = [];
    imagePreview.innerHTML = "";
    imageInput.value = "";
    document.getElementById("modal-title").textContent = "Add New Product";
    productModal.classList.remove("hidden");
    productModal.classList.add("active");
  });

  closeModalBtns.forEach((btn) =>
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      productModal.classList.remove("active");
      productModal.classList.add("hidden");
    })
  );

  uploadZone?.addEventListener("click", (e) => {
    e.preventDefault();
    imageInput.click();
  });

  imageInput?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    if (selectedFiles.length + files.length > 4) {
      showToast("Maximum 4 images allowed", "error");
      imageInput.value = "";
      return;
    }
    showToast("Compressing images...", "success");
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      selectedFiles.push(await compressImage(file));
    }
    renderPreview();
    imageInput.value = "";
  });

  function renderPreview() {
    imagePreview.innerHTML = "";
    selectedFiles.forEach((file, index) => {
      const div = document.createElement("div");
      div.className = "preview-item";
      div.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1e293b;border-radius:8px;position:relative;padding:8px;";
      const nameEl = document.createElement("p");
      nameEl.textContent = file.name;
      nameEl.style.cssText = "font-size:0.7rem;color:#94a3b8;margin:0;word-break:break-all;";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "×";
      removeBtn.style.cssText = "position:absolute;top:4px;right:4px;width:22px;height:22px;background:#ef4444;color:#fff;border:none;border-radius:50%;cursor:pointer;";
      removeBtn.onclick = () => {
        selectedFiles.splice(index, 1);
        renderPreview();
      };
      div.appendChild(nameEl);
      div.appendChild(removeBtn);
      imagePreview.appendChild(div);
    });
  }

  productForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = productId.value;
    const isEdit = id !== "";

    const formData = new FormData();
    formData.append("name", productName.value.trim());
    formData.append("price", productPrice.value);
    formData.append("description", productDesc.value.trim());
    if (productCategory) formData.append("category", productCategory.value);
    if (productShape) formData.append("shape", productShape.value);
    if (productGender) formData.append("gender", productGender.value);
    if (productStock) formData.append("stock", productStock.value);

    selectedFiles.forEach((file) => formData.append("images", file));

    const url = isEdit ? `/api/admin/products/${id}` : "/api/admin/products";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await apiFetch(url, { method, body: formData });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Save failed", "error");
        return;
      }
      showToast("Product saved successfully");
      productModal.classList.remove("active");
      productModal.classList.add("hidden");
      productForm.reset();
      selectedFiles = [];
      imagePreview.innerHTML = "";
      loadProducts();
    } catch {
      showToast("Server error", "error");
    }
  });

  searchInput?.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase();
    renderProducts(allProducts.filter((p) => p.name.toLowerCase().includes(val)));
  });

  function editProduct(id) {
    const product = allProducts.find((p) => Number(p.id) === id);
    if (!product) return;
    document.getElementById("modal-title").textContent = "Edit Product";
    productId.value = product.id;
    productName.value = product.name;
    productPrice.value = product.price;
    productDesc.value = product.description || "";
    if (productCategory) productCategory.value = product.category || "eyeglasses";
    if (productShape) productShape.value = product.shape || "wayfarer";
    if (productGender) productGender.value = product.gender || "unisex";
    if (productStock) productStock.value = product.stock ?? 25;

    selectedFiles = [];
    imageInput.value = "";
    imagePreview.innerHTML = "";
    productModal.classList.remove("hidden");
    productModal.classList.add("active");
  }

  async function deleteProduct(id) {
    if (!confirm("Delete this product permanently?")) return;
    try {
      const res = await apiFetch(`/api/admin/products/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Delete failed", "error");
        return;
      }
      showToast("Product deleted");
      loadProducts();
    } catch {
      showToast("Server error", "error");
    }
  }
});
