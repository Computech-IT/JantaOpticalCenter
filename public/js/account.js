document.addEventListener("DOMContentLoaded", () => {
  const authView = document.getElementById("authView");
  const dashboard = document.getElementById("accountDashboard");

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(msg) {
    const c = document.getElementById("toasts");
    if (!c) return;
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  async function checkSession() {
    try {
      const res = await fetch("/api/customers/me", { credentials: "same-origin" });
      if (!res.ok) {
        authView.classList.remove("hidden");
        dashboard.classList.add("hidden");
        return;
      }
      const { customer } = await res.json();
      document.getElementById("custName").textContent = customer.name;
      document.getElementById("custEmail").textContent = customer.email;
      authView.classList.add("hidden");
      dashboard.classList.remove("hidden");
      loadPrescriptions();
      loadOrders();
    } catch {}
  }

  async function loadPrescriptions() {
    const el = document.getElementById("rxList");
    const res = await fetch("/api/customers/prescriptions", { credentials: "same-origin" });
    if (!res.ok) return;
    const list = await res.json();
    if (list.length === 0) {
      el.innerHTML = "<p style='color:var(--text-muted);font-size:14px;'>No saved prescriptions yet.</p>";
      return;
    }
    el.innerHTML = list
      .map(
        (rx) => `
      <div class="item-box">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>${escapeHtml(rx.label)}</strong>
          <button type="button" data-del-rx="${Number(rx.id)}" style="color:#dc2626;font-size:12px;font-weight:600;">Delete</button>
        </div>
        <p style="font-size:13px;margin-top:6px;">
          OD: SPH ${escapeHtml(rx.od_sph || "-")} | CYL ${escapeHtml(rx.od_cyl || "-")} | AXIS ${escapeHtml(rx.od_axis || "-")}<br>
          OS: SPH ${escapeHtml(rx.os_sph || "-")} | CYL ${escapeHtml(rx.os_cyl || "-")} | AXIS ${escapeHtml(rx.os_axis || "-")}<br>
          PD: ${escapeHtml(rx.pd || "-")} mm
        </p>
      </div>
    `
      )
      .join("");

    el.querySelectorAll("[data-del-rx]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        await fetch(`/api/customers/prescriptions/${btn.dataset.delRx}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        showToast("Prescription removed");
        loadPrescriptions();
      });
    });
  }

  async function loadOrders() {
    const el = document.getElementById("ordersHistory");
    const res = await fetch("/api/customers/orders", { credentials: "same-origin" });
    if (!res.ok) return;
    const orders = await res.json();
    if (orders.length === 0) {
      el.innerHTML = "<p style='color:var(--text-muted);font-size:14px;'>No orders placed yet.</p>";
      return;
    }
    el.innerHTML = orders
      .map(
        (o) => `
      <div class="item-box">
        <div style="display:flex;justify-content:space-between;">
          <strong>${escapeHtml(o.order_number || `#${o.id}`)}</strong>
          <span class="status-badge">${escapeHtml((o.status || "pending").toUpperCase())}</span>
        </div>
        <p style="font-size:13px;margin-top:6px;">
          Total: <strong>₹${Number(o.total || 0).toLocaleString("en-IN")}</strong> • Payment: ${escapeHtml((o.payment_status || "unpaid").toUpperCase())}
        </p>
      </div>
    `
      )
      .join("");
  }

  document.getElementById("customerLoginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await fetch("/api/customers/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: document.getElementById("loginEmail").value.trim(),
        password: document.getElementById("loginPassword").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || "Sign in failed");
    showToast("Signed in!");
    checkSession();
  });

  document.getElementById("customerRegisterForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await fetch("/api/customers/register", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("regName").value.trim(),
        email: document.getElementById("regEmail").value.trim(),
        phone: document.getElementById("regPhone").value.trim(),
        password: document.getElementById("regPassword").value,
      }),
    });
    const data = await res.json();
    if (!res.ok) return showToast(data.error || "Registration failed");
    showToast("Account created!");
    checkSession();
  });

  document.getElementById("custLogoutBtn")?.addEventListener("click", async () => {
    await fetch("/api/customers/logout", { method: "POST", credentials: "same-origin" });
    showToast("Signed out");
    checkSession();
  });

  document.getElementById("rxForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const res = await fetch("/api/customers/prescriptions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: document.getElementById("rxLabel").value.trim(),
        od_sph: document.getElementById("odSph").value.trim(),
        od_cyl: document.getElementById("odCyl").value.trim(),
        od_axis: document.getElementById("odAxis").value.trim(),
        os_sph: document.getElementById("osSph").value.trim(),
        os_cyl: document.getElementById("osCyl").value.trim(),
        os_axis: document.getElementById("osAxis").value.trim(),
        pd: document.getElementById("rxPd").value.trim(),
      }),
    });
    if (!res.ok) return showToast("Failed to save prescription");
    e.target.reset();
    showToast("Prescription saved!");
    loadPrescriptions();
  });

  checkSession();
});
