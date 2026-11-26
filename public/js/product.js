document.addEventListener("DOMContentLoaded", async () => {
  const LENS_PACKAGES = {
    frame_only: { label: "Frame Only (Demo Lenses)", price: 0 },
    single_vision: { label: "Single Vision Anti-Glare", price: 600 },
    blue_cut: { label: "Blue-Cut Computer Protection", price: 1100 },
    progressive: { label: "Progressive Multifocal", price: 2400 },
  };

  const root = document.getElementById("pdpRoot");
  const breadcrumb = document.getElementById("pdpBreadcrumb");
  const params = new URLSearchParams(window.location.search);
  const slugOrId = params.get("slug") || params.get("id");

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

  if (!slugOrId) {
    root.innerHTML = '<p>No product specified. <a href="/" class="btn btn-primary">Back to Shop</a></p>';
    return;
  }

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(slugOrId)}`);
    if (!res.ok) throw new Error("Product not found");
    const product = await res.json();

    document.title = `${product.name} | Janta Optical Centre`;
    if (breadcrumb) breadcrumb.textContent = product.name;

    const imgs = Array.isArray(product.images) ? product.images : [];
    const firstImg = imgs[0] ? `/images/products/${imgs[0]}` : "";
    let selectedLens = "frame_only";

    root.innerHTML = `
      <div class="pdp-gallery">
        ${
          firstImg
            ? `<img id="pdpMainImg" class="pdp-main-img" src="${escapeHtml(firstImg)}" alt="${escapeHtml(product.name)}">`
            : '<div class="no-img-placeholder" style="height:360px;display:flex;align-items:center;justify-content:center;">👓</div>'
        }
        ${
          imgs.length > 1
            ? `<div class="pdp-thumbs">
                ${imgs
                  .map(
                    (img, i) =>
                      `<img src="/images/products/${escapeHtml(img)}" class="pdp-thumb ${i === 0 ? "active" : ""}" data-src="/images/products/${escapeHtml(img)}" alt="Angle ${i + 1}">`
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>

      <div class="pdp-info">
        <div class="modal-meta-badges">
          <span class="meta-pill">${escapeHtml(product.category || "Eyeglasses")}</span>
          <span class="meta-pill">${escapeHtml(product.shape || "Wayfarer")}</span>
          <span class="meta-pill">${escapeHtml(product.gender || "Unisex")}</span>
        </div>
        <h1>${escapeHtml(product.name)}</h1>
        <p style="color:var(--text-muted);line-height:1.7;">${escapeHtml(product.description || "Precision-crafted optical frame designed for all-day comfort.")}</p>
        <div class="pdp-price" id="pdpPrice">₹${Number(product.price).toLocaleString("en-IN")}</div>

        <h4 style="font-size:14px;text-transform:uppercase;letter-spacing:0.6px;">1. Choose Lens Package</h4>
        <div class="pdp-lens-cards" id="pdpLensCards">
          ${Object.entries(LENS_PACKAGES)
            .map(
              ([key, pkg]) => `
            <label class="lens-option ${key === "frame_only" ? "selected" : ""}" data-lens="${key}">
              <span><input type="radio" name="lensPkg" value="${key}" ${key === "frame_only" ? "checked" : ""}> ${escapeHtml(pkg.label)}</span>
              <strong>${pkg.price === 0 ? "Included" : `+₹${pkg.price.toLocaleString("en-IN")}`}</strong>
            </label>
          `
            )
            .join("")}
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <button type="button" id="pdpAddToCart" class="btn btn-primary" style="flex:1;" ${product.stock <= 0 ? "disabled" : ""}>
            ${product.stock <= 0 ? "Out of Stock" : "Add to Cart"}
          </button>
          <a href="/" class="btn btn-secondary">Back to Store</a>
        </div>

        <table class="pdp-specs">
          <tr><td>SKU</td><td><strong>${escapeHtml(product.sku)}</strong></td></tr>
          <tr><td>Frame Material</td><td>${escapeHtml(product.frame_material || "Acetate")}</td></tr>
          <tr><td>Frame Size</td><td>${escapeHtml(product.frame_size || "Medium")}</td></tr>
          <tr><td>Availability</td><td>${product.stock > 0 ? `In Stock (${product.stock} units)` : "Out of Stock"}</td></tr>
        </table>
      </div>
    `;

    root.querySelectorAll(".pdp-thumb").forEach((thumb) => {
      thumb.addEventListener("click", () => {
        const main = document.getElementById("pdpMainImg");
        if (main) main.src = thumb.dataset.src;
        root.querySelectorAll(".pdp-thumb").forEach((t) => t.classList.remove("active"));
        thumb.classList.add("active");
      });
    });

    root.querySelectorAll("input[name='lensPkg']").forEach((radio) => {
      radio.addEventListener("change", () => {
        selectedLens = radio.value;
        root.querySelectorAll(".lens-option").forEach((el) => {
          el.classList.toggle("selected", el.dataset.lens === selectedLens);
        });
        const total = Number(product.price) + (LENS_PACKAGES[selectedLens]?.price || 0);
        document.getElementById("pdpPrice").textContent = `₹${total.toLocaleString("en-IN")}`;
      });
    });

    document.getElementById("pdpAddToCart")?.addEventListener("click", () => {
      let cart = [];
      try {
        cart = JSON.parse(localStorage.getItem("jantaCart") || "[]");
      } catch {}
      const existing = cart.find(
        (i) => Number(i.id) === Number(product.id) && i.lensPackage === selectedLens
      );
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({
          id: Number(product.id),
          name: product.name,
          framePrice: Number(product.price),
          lensPackage: selectedLens,
          qty: 1,
          image: product.images?.[0] || "",
        });
      }
      localStorage.setItem("jantaCart", JSON.stringify(cart));
      showToast("Added to cart! Returning to cart...");
      setTimeout(() => {
        window.location.href = "/#collection";
      }, 900);
    });
  } catch {
    root.innerHTML = '<p>Eyewear not found. <a href="/" class="btn btn-primary">Return Home</a></p>';
  }
});
