document.addEventListener("DOMContentLoaded", () => {
  const LENS_PACKAGES = {
    frame_only: { label: "Frame Only", price: 0 },
    single_vision: { label: "Single Vision Anti-Glare", price: 600 },
    blue_cut: { label: "Blue-Cut Computer Protection", price: 1100 },
    progressive: { label: "Progressive Multifocal", price: 2400 },
  };
  const FREE_SHIPPING_THRESHOLD = 999;
  const FLAT_SHIPPING_FEE = 79;

  let products = [];
  let cart = [];
  let activeFilters = {
    q: "",
    category: "all",
    shape: "all",
    gender: "all",
    sort: "newest",
  };

  // DOM References
  const productGrid = document.getElementById("productGrid");
  const catalogResultCount = document.getElementById("catalogResultCount");
  const catalogSearch = document.getElementById("catalogSearch");
  const filterCategory = document.getElementById("filterCategory");
  const filterGender = document.getElementById("filterGender");
  const filterSort = document.getElementById("filterSort");
  const resetFiltersBtn = document.getElementById("resetFiltersBtn");

  // Modal elements
  const imageModal = document.getElementById("imageModal");
  const modalViewer = document.getElementById("modalViewer");
  const modalThumbs = document.getElementById("modalThumbs");
  const modalClose = document.getElementById("modalClose");
  const modalTitle = document.getElementById("modalTitle");
  const modalDesc = document.getElementById("modalDesc");
  const modalBadges = document.getElementById("modalBadges");
  const modalLensSelect = document.getElementById("modalLensSelect");
  const modalPrice = document.getElementById("modalPrice");
  const modalAdd = document.getElementById("modalAdd");

  // Cart elements
  const cartDrawer = document.getElementById("cartDrawer");
  const openCartBtn = document.getElementById("openCartBtn");
  const floatingCartBtn = document.getElementById("floatingCartBtn");
  const cartCloseBtn = document.getElementById("cart-close");
  const backdrop = document.getElementById("backdrop");
  const navCartCount = document.getElementById("navCartCount");
  const floatingCartCount = document.getElementById("floatingCartCount");
  const mobileCartBadge = document.getElementById("mobileCartBadge");
  const cartItemsEl = document.getElementById("cartItems");
  const cartEmptyEl = document.getElementById("cartEmpty");
  const cartSummaryEl = document.getElementById("cartSummary");
  const subtotalPriceEl = document.getElementById("subtotalPrice");
  const shippingFeeTextEl = document.getElementById("shippingFeeText");
  const totalPriceEl = document.getElementById("totalPrice");
  const shippingContainer = document.getElementById("shippingContainer");
  const checkoutBtn = document.getElementById("checkoutBtn");
  const whatsappOrderBtn = document.getElementById("whatsappOrder");

  // Checkout elements
  const checkoutModal = document.getElementById("checkoutModal");
  const checkoutForm = document.getElementById("checkoutForm");
  const checkoutClose = document.getElementById("checkoutClose");
  const rxFileInput = document.getElementById("rxFileInput");
  const rxFilePreview = document.getElementById("rxFilePreview");
  let selectedRxFile = null;

  rxFileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Prescription file must be under 5 MB");
      rxFileInput.value = "";
      return;
    }
    selectedRxFile = file;
    if (rxFilePreview) {
      rxFilePreview.classList.remove("hidden");
      rxFilePreview.innerHTML = `<span>Attached: <strong>${escapeHtml(file.name)}</strong></span><button type="button" id="removeRxFileBtn" style="color:#dc2626;font-weight:700;">Remove</button>`;
      document.getElementById("removeRxFileBtn")?.addEventListener("click", () => {
        selectedRxFile = null;
        rxFileInput.value = "";
        rxFilePreview.classList.add("hidden");
        rxFilePreview.innerHTML = "";
      });
    }
  });

  // Track order elements
  const trackOrderModal = document.getElementById("trackOrderModal");
  const trackOrderForm = document.getElementById("trackOrderForm");
  const trackOrderClose = document.getElementById("trackOrderClose");
  const trackOrderResult = document.getElementById("trackOrderResult");

  // Utilities
  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveImgUrl(img) {
    if (!img) return "";
    if (img.startsWith("http") || img.startsWith("data:") || img.startsWith("/images/") || img.startsWith("images/")) {
      return img.startsWith("/") || img.startsWith("http") || img.startsWith("data:") ? img : `/${img}`;
    }
    return `/images/products/${img}`;
  }

  function formatINR(amount) {
    return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
  }

  function showToast(message) {
    const container = document.getElementById("toasts");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Cart Persistence
  function saveCart() {
    try {
      localStorage.setItem("jantaCart", JSON.stringify(cart));
    } catch (err) {
      console.warn("Cart save failed:", err);
    }
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem("jantaCart");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cart = parsed.map((item) => ({
            id: Number(item.id),
            name: String(item.name || "Frame"),
            framePrice: Number(item.framePrice ?? item.price ?? 0),
            lensPackage: item.lensPackage && LENS_PACKAGES[item.lensPackage] ? item.lensPackage : "frame_only",
            qty: Math.max(1, Number(item.qty || 1)),
            image: item.image || "",
          }));
        }
      }
    } catch {
      cart = [];
    }
  }

  function addToCart(product, lensPackage = "frame_only") {
    const existing = cart.find(
      (item) => item.id === Number(product.id) && item.lensPackage === lensPackage
    );
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({
        id: Number(product.id),
        name: product.name,
        framePrice: Number(product.price),
        lensPackage,
        qty: 1,
        image: product.images?.[0] || "",
      });
    }
    saveCart();
    renderCart();
    openCart();
    const lensLabel = LENS_PACKAGES[lensPackage]?.label || "Frame Only";
    showToast(`${product.name} (${lensLabel}) added to cart`);
  }

  function updateCartItemQty(index, delta) {
    if (!cart[index]) return;
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
    saveCart();
    renderCart();
  }

  function renderCart() {
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => {
      const lensPrice = LENS_PACKAGES[item.lensPackage]?.price || 0;
      return sum + (item.framePrice + lensPrice) * item.qty;
    }, 0);
    const shippingFee = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
    const grandTotal = subtotal + shippingFee;

    if (navCartCount) navCartCount.textContent = totalCount;
    if (floatingCartCount) floatingCartCount.textContent = totalCount;
    if (floatingCartBtn) floatingCartBtn.style.display = totalCount > 0 ? "flex" : "none";
    if (mobileCartBadge) {
      mobileCartBadge.style.display = totalCount > 0 ? "block" : "none";
      mobileCartBadge.textContent = totalCount;
    }

    if (cart.length === 0) {
      if (cartItemsEl) cartItemsEl.style.display = "none";
      if (cartEmptyEl) cartEmptyEl.style.display = "flex";
      if (cartSummaryEl) cartSummaryEl.style.display = "none";
      if (checkoutBtn) checkoutBtn.style.display = "none";
      if (shippingContainer) shippingContainer.innerHTML = "";
      return;
    }

    if (cartItemsEl) {
      cartItemsEl.style.display = "block";
      cartItemsEl.innerHTML = cart
        .map((item, idx) => {
          const lens = LENS_PACKAGES[item.lensPackage] || LENS_PACKAGES.frame_only;
          const unitPrice = item.framePrice + lens.price;
          const prod = products.find((p) => Number(p.id) === item.id);
          const imgFile = item.image || prod?.images?.[0] || "";
          const imgSrc = resolveImgUrl(imgFile);

          return `
            <div class="cart-item">
              ${
                imgSrc
                  ? `<img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.name)}" loading="lazy">`
                  : '<div class="cart-item-no-img">👓</div>'
              }
              <div class="cart-item-details">
                <h4>${escapeHtml(item.name)}</h4>
                <p class="cart-item-lens">${escapeHtml(lens.label)}</p>
                <p class="cart-item-price">${formatINR(unitPrice)} × ${item.qty} = <strong>${formatINR(unitPrice * item.qty)}</strong></p>
                <div class="cart-controls">
                  <button type="button" class="qty-btn" data-cart-idx="${idx}" data-delta="-1" aria-label="Decrease quantity">−</button>
                  <span class="qty-val">${item.qty}</span>
                  <button type="button" class="qty-btn" data-cart-idx="${idx}" data-delta="1" aria-label="Increase quantity">+</button>
                </div>
              </div>
              <button type="button" class="remove-btn-icon" data-cart-idx="${idx}" data-delta="-9999" title="Remove item" aria-label="Remove item">✕</button>
            </div>
          `;
        })
        .join("");
    }

    if (cartEmptyEl) cartEmptyEl.style.display = "none";
    if (cartSummaryEl) cartSummaryEl.style.display = "block";
    if (checkoutBtn) checkoutBtn.style.display = "block";

    const remaining = FREE_SHIPPING_THRESHOLD - subtotal;
    if (shippingContainer) {
      shippingContainer.innerHTML =
        remaining > 0
          ? `<div class="shipping-bar">Add <b>${formatINR(remaining)}</b> more for <b>Free Pan-India Shipping</b></div>`
          : '<div class="shipping-bar success">You have unlocked <b>Free Pan-India Shipping!</b></div>';
    }

    if (subtotalPriceEl) subtotalPriceEl.textContent = formatINR(subtotal);
    if (shippingFeeTextEl) shippingFeeTextEl.textContent = shippingFee === 0 ? "FREE" : formatINR(shippingFee);
    if (totalPriceEl) totalPriceEl.textContent = formatINR(grandTotal);
  }

  function openCart() {
    cartDrawer?.classList.add("open");
    backdrop?.classList.add("open");
  }

  function closeCart() {
    cartDrawer?.classList.remove("open");
    backdrop?.classList.remove("open");
  }

  // Product Loading & Rendering
  function renderSkeletons(count = 6) {
    if (!productGrid) return;
    productGrid.innerHTML = Array.from({ length: count })
      .map(
        () => `
        <div class="product-card skeleton-card">
          <div class="skeleton skeleton-img"></div>
          <div class="skeleton-info">
            <div class="skeleton skeleton-line" style="width:70%"></div>
            <div class="skeleton skeleton-line" style="width:40%; height:14px; margin-top:8px"></div>
          </div>
        </div>
      `
      )
      .join("");
  }

  async function fetchProducts() {
    renderSkeletons();
    const params = new URLSearchParams();
    if (activeFilters.q) params.set("q", activeFilters.q);
    if (activeFilters.category !== "all") params.set("category", activeFilters.category);
    if (activeFilters.shape !== "all") params.set("shape", activeFilters.shape);
    if (activeFilters.gender !== "all") params.set("gender", activeFilters.gender);
    if (activeFilters.sort) params.set("sort", activeFilters.sort);

    try {
      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      products = Array.isArray(data) ? data : [];
      renderProducts(products);
    } catch (err) {
      console.error("Failed to load products:", err);
      if (productGrid) {
        productGrid.innerHTML = `<p class="load-error">Unable to load products right now. Please refresh.</p>`;
      }
    }
  }

  function renderProducts(list) {
    if (!productGrid) return;
    if (catalogResultCount) {
      catalogResultCount.textContent = `Showing ${list.length} ${list.length === 1 ? "frame" : "frames"}`;
    }

    if (list.length === 0) {
      productGrid.innerHTML = `
        <div class="empty-catalog">
          <p>No eyewear matched your current filters.</p>
          <button type="button" class="btn btn-secondary" id="inlineResetBtn">Clear All Filters</button>
        </div>
      `;
      document.getElementById("inlineResetBtn")?.addEventListener("click", resetAllFilters);
      return;
    }

    productGrid.innerHTML = list
      .map((p) => {
        const imgs = Array.isArray(p.images) ? p.images : [];
        const mainImg = resolveImgUrl(imgs[0] || "");
        const stockBadge =
          p.stock <= 0
            ? '<span class="stock-badge out">Out of Stock</span>'
            : p.stock <= 5
            ? `<span class="stock-badge low">Only ${p.stock} left</span>`
            : "";

        return `
          <article class="product-card" data-id="${Number(p.id)}">
            <div class="product-image-wrap">
              ${stockBadge}
              ${
                mainImg
                  ? `<img src="${escapeHtml(mainImg)}" alt="${escapeHtml(p.name)}" class="product-image main-img" loading="lazy">`
                  : '<div class="no-img-placeholder">👓</div>'
              }
              <div class="product-overlay">
                <div class="overlay-actions">
                  <button type="button" data-action="quickview">CUSTOMIZE &amp; VIEW</button>
                </div>
              </div>
            </div>
            ${
              imgs.length > 1
                ? `<div class="product-thumbnails">
                    ${imgs
                      .map(
                        (img, idx) =>
                          `<img src="${escapeHtml(resolveImgUrl(img))}" alt="${escapeHtml(p.name)} view ${idx + 1}" class="card-thumb ${idx === 0 ? "active" : ""}" data-src="${escapeHtml(resolveImgUrl(img))}" loading="lazy">`
                      )
                      .join("")}
                  </div>`
                : ""
            }
            <div class="product-info">
              <span class="product-meta-line">${escapeHtml((p.shape || "wayfarer").toUpperCase())} • ${escapeHtml(p.frame_material || "Acetate")}</span>
              <h3><a href="/product.html?slug=${encodeURIComponent(p.slug || p.id)}">${escapeHtml(p.name)}</a></h3>
              <div class="product-info-row">
                <p class="price">${formatINR(p.price)}</p>
                <button type="button" class="add-to-cart-btn" data-action="addcart" aria-label="Quick add ${escapeHtml(p.name)} to cart" ${p.stock <= 0 ? "disabled" : ""}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");
  }

  // Quick View & Lens Configurator Modal
  let activeModalProduct = null;

  function openProductModal(product) {
    activeModalProduct = product;
    const imgs = Array.isArray(product.images) ? product.images : [];

    if (modalTitle) modalTitle.textContent = product.name;
    if (modalDesc) modalDesc.textContent = product.description || "Handcrafted optical frame with precision hinges and comfortable nose pads.";
    if (modalBadges) {
      modalBadges.innerHTML = `
        <span class="meta-pill">${escapeHtml(product.category || "Eyeglasses")}</span>
        <span class="meta-pill">${escapeHtml(product.shape || "Wayfarer")}</span>
        <span class="meta-pill">${escapeHtml(product.frame_size || "Medium")} Fit</span>
      `;
    }

    if (modalViewer) {
      modalViewer.innerHTML = imgs
        .map(
          (img) => `
          <div class="slideshow-item">
            <img src="${escapeHtml(resolveImgUrl(img))}" alt="${escapeHtml(product.name)}" loading="lazy">
          </div>`
        )
        .join("");
      modalViewer.scrollLeft = 0;
    }

    if (modalThumbs) {
      modalThumbs.innerHTML = imgs
        .map(
          (img, idx) =>
            `<img src="${escapeHtml(resolveImgUrl(img))}" alt="Thumbnail ${idx + 1}" class="slideshow-thumb ${idx === 0 ? "active" : ""}" data-index="${idx}" loading="lazy">`
        )
        .join("");
    }

    if (modalLensSelect) {
      modalLensSelect.value = "frame_only";
      updateModalPrice();
    }

    imageModal?.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function updateModalPrice() {
    if (!activeModalProduct || !modalPrice) return;
    const selectedLens = modalLensSelect?.value || "frame_only";
    const lensPrice = LENS_PACKAGES[selectedLens]?.price || 0;
    modalPrice.textContent = formatINR(Number(activeModalProduct.price) + lensPrice);
  }

  function closeProductModal() {
    imageModal?.classList.remove("open");
    document.body.style.overflow = "";
    activeModalProduct = null;
  }

  modalLensSelect?.addEventListener("change", updateModalPrice);
  modalClose?.addEventListener("click", closeProductModal);
  modalAdd?.addEventListener("click", () => {
    if (!activeModalProduct) return;
    const lensPackage = modalLensSelect?.value || "frame_only";
    addToCart(activeModalProduct, lensPackage);
    closeProductModal();
  });

  // Event Delegation on Product Grid
  productGrid?.addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (!card) return;

    if (e.target.classList.contains("card-thumb")) {
      e.stopPropagation();
      const mainImg = card.querySelector(".main-img");
      if (mainImg) mainImg.src = e.target.dataset.src;
      card.querySelectorAll(".card-thumb").forEach((t) => t.classList.remove("active"));
      e.target.classList.add("active");
      return;
    }

    const id = Number(card.dataset.id);
    const product = products.find((p) => Number(p.id) === id);
    if (!product) return;

    if (e.target.closest("[data-action='addcart']")) {
      e.stopPropagation();
      addToCart(product, "frame_only");
      return;
    }

    if (e.target.closest(".product-image-wrap") || e.target.dataset.action === "quickview") {
      openProductModal(product);
    }
  });

  // Cart item quantity delegation
  cartItemsEl?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cart-idx]");
    if (!btn) return;
    const idx = Number(btn.dataset.cartIdx);
    const delta = Number(btn.dataset.delta);
    updateCartItemQty(idx, delta);
  });

  modalThumbs?.addEventListener("click", (e) => {
    if (e.target.classList.contains("slideshow-thumb")) {
      const idx = Number(e.target.dataset.index);
      modalViewer?.scrollTo({ left: modalViewer.clientWidth * idx, behavior: "smooth" });
      modalThumbs.querySelectorAll(".slideshow-thumb").forEach((t, i) => t.classList.toggle("active", i === idx));
    }
  });

  // Filter & Search Listeners
  let searchTimer;
  catalogSearch?.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      activeFilters.q = e.target.value.trim();
      fetchProducts();
    }, 250);
  });

  filterCategory?.addEventListener("change", (e) => {
    activeFilters.category = e.target.value;
    fetchProducts();
  });

  filterGender?.addEventListener("change", (e) => {
    activeFilters.gender = e.target.value;
    fetchProducts();
  });

  filterSort?.addEventListener("change", (e) => {
    activeFilters.sort = e.target.value;
    fetchProducts();
  });

  document.querySelectorAll(".category-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".category-card").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilters.shape = btn.dataset.shape || "all";
      fetchProducts();
    });
  });

  function resetAllFilters() {
    activeFilters = { q: "", category: "all", shape: "all", gender: "all", sort: "newest" };
    if (catalogSearch) catalogSearch.value = "";
    if (filterCategory) filterCategory.value = "all";
    if (filterGender) filterGender.value = "all";
    if (filterSort) filterSort.value = "newest";
    document.querySelectorAll(".category-card").forEach((b) => {
      b.classList.toggle("active", b.dataset.shape === "all");
    });
    fetchProducts();
  }
  resetFiltersBtn?.addEventListener("click", resetAllFilters);

  // Navbar quick filters
  document.querySelectorAll("[data-filter-gender]").forEach((link) => {
    link.addEventListener("click", () => {
      const g = link.getAttribute("data-filter-gender");
      activeFilters.gender = g;
      if (filterGender) filterGender.value = g;
      fetchProducts();
    });
  });

  document.querySelectorAll("[data-filter-category]").forEach((link) => {
    link.addEventListener("click", () => {
      const c = link.getAttribute("data-filter-category");
      activeFilters.category = c;
      if (filterCategory) filterCategory.value = c;
      fetchProducts();
    });
  });

  // Search button focus
  function focusCatalogSearch() {
    document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => catalogSearch?.focus(), 350);
  }
  document.getElementById("navSearchBtn")?.addEventListener("click", focusCatalogSearch);
  document.getElementById("mobileSearchNav")?.addEventListener("click", (e) => {
    e.preventDefault();
    focusCatalogSearch();
  });

  // Cart & Checkout Controls
  openCartBtn?.addEventListener("click", openCart);
  floatingCartBtn?.addEventListener("click", openCart);
  cartCloseBtn?.addEventListener("click", closeCart);
  backdrop?.addEventListener("click", closeCart);

  whatsappOrderBtn?.addEventListener("click", () => {
    if (cart.length === 0) return showToast("Your cart is empty!");
    let msg = "*New Order — Janta Optical Centre*\n----------------------------------\n";
    let subtotal = 0;
    cart.forEach((item, idx) => {
      const lens = LENS_PACKAGES[item.lensPackage] || LENS_PACKAGES.frame_only;
      const unit = item.framePrice + lens.price;
      subtotal += unit * item.qty;
      msg += `${idx + 1}. ${item.name} (${lens.label}) × ${item.qty} = ${formatINR(unit * item.qty)}\n`;
    });
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
    msg += `----------------------------------\nSubtotal: ${formatINR(subtotal)}\nShipping: ${shipping === 0 ? "FREE" : formatINR(shipping)}\n*Total: ${formatINR(subtotal + shipping)}*\n\nKindly confirm availability & delivery details.`;
    window.open(`https://wa.me/918768837581?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  });

  function renderCheckoutSummary() {
    const subtotal = cart.reduce((sum, item) => {
      const lensPrice = LENS_PACKAGES[item.lensPackage]?.price || 0;
      return sum + (item.framePrice + lensPrice) * item.qty;
    }, 0);
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const shipping = subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_FEE;
    const grandTotal = subtotal + shipping;

    const labelEl = document.getElementById("checkoutSummaryLabel");
    const totalEl = document.getElementById("checkoutSummaryTotal");
    const itemsEl = document.getElementById("checkoutSummaryItems");
    const confirmBtn = document.getElementById("confirmOrderBtn");

    if (labelEl) {
      labelEl.textContent = `${totalCount} ${totalCount === 1 ? "item" : "items"} • ${shipping === 0 ? "Free Shipping" : `Shipping ${formatINR(shipping)}`}`;
    }
    if (totalEl) totalEl.textContent = formatINR(grandTotal);
    if (confirmBtn && !confirmBtn.disabled) {
      confirmBtn.textContent = grandTotal > 0 ? `Place Order • ${formatINR(grandTotal)}` : "Place Order";
    }
    if (itemsEl) {
      itemsEl.innerHTML = cart
        .map((item) => {
          const lens = LENS_PACKAGES[item.lensPackage] || LENS_PACKAGES.frame_only;
          const lineTotal = (item.framePrice + lens.price) * item.qty;
          return `<div class="chk-summary-line"><span>${escapeHtml(item.name)} (${escapeHtml(lens.label)}) × ${item.qty}</span><strong>${formatINR(lineTotal)}</strong></div>`;
        })
        .join("");
    }
  }

  document.getElementById("chkSummaryToggle")?.addEventListener("click", () => {
    const itemsEl = document.getElementById("checkoutSummaryItems");
    const btn = document.getElementById("chkSummaryToggle");
    if (!itemsEl) return;
    const isHidden = itemsEl.classList.toggle("hidden");
    btn?.setAttribute("aria-expanded", String(!isHidden));
  });

  // Tappable Payment Method Cards
  document.querySelectorAll("#paymentCards .pay-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll("#paymentCards .pay-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const hiddenInput = document.getElementById("orderPayment");
      if (hiddenInput) hiddenInput.value = card.dataset.pay || "cod";
    });
  });

  // 3-Tab Segmented Prescription Selector
  document.querySelectorAll(".rx-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".rx-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const target = tab.dataset.rxTab;
      document.getElementById("rxPanelLater")?.classList.toggle("hidden", target !== "later");
      document.getElementById("rxPanelUpload")?.classList.toggle("hidden", target !== "upload");
      document.getElementById("rxPanelManual")?.classList.toggle("hidden", target !== "manual");
    });
  });

  checkoutBtn?.addEventListener("click", () => {
    if (cart.length === 0) return showToast("Your cart is empty!");
    renderCheckoutSummary();
    closeCart();
    checkoutModal?.classList.add("active");
  });

  checkoutClose?.addEventListener("click", () => checkoutModal?.classList.remove("active"));

  checkoutForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const confirmBtn = document.getElementById("confirmOrderBtn");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Placing Order...";

    const prescriptionData = {
      od_sph: document.getElementById("chkOdSph")?.value.trim() || "",
      od_cyl: document.getElementById("chkOdCyl")?.value.trim() || "",
      od_axis: document.getElementById("chkOdAxis")?.value.trim() || "",
      os_sph: document.getElementById("chkOsSph")?.value.trim() || "",
      os_cyl: document.getElementById("chkOsCyl")?.value.trim() || "",
      os_axis: document.getElementById("chkOsAxis")?.value.trim() || "",
      pd: document.getElementById("chkPd")?.value.trim() || "",
    };
    const hasRxNumbers = Object.values(prescriptionData).some(Boolean);

    const payload = {
      name: document.getElementById("orderName").value.trim(),
      phone: document.getElementById("orderPhone").value.trim(),
      email: document.getElementById("orderEmail")?.value.trim() || "",
      address: document.getElementById("orderAddress").value.trim(),
      paymentMethod: document.getElementById("orderPayment")?.value || "cod",
      notes: document.getElementById("orderNotes").value.trim(),
      items: cart.map((i) => ({ id: i.id, qty: i.qty, lensPackage: i.lensPackage })),
      ...(hasRxNumbers ? { prescription: prescriptionData } : {}),
    };

    const formData = new FormData();
    formData.append("name", payload.name);
    formData.append("phone", payload.phone);
    if (payload.email) formData.append("email", payload.email);
    formData.append("address", payload.address);
    formData.append("paymentMethod", payload.paymentMethod);
    formData.append("notes", payload.notes);
    formData.append("items", JSON.stringify(payload.items));
    if (hasRxNumbers) formData.append("prescription", JSON.stringify(prescriptionData));
    if (selectedRxFile) formData.append("prescriptionFile", selectedRxFile);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || "Order failed. Please check your details.";
        console.warn("Order submission rejected:", data);
        showToast(msg);
        return;
      }

      if (payload.paymentMethod === "razorpay") {
        const cfgRes = await fetch("/api/payments/config");
        const cfg = await cfgRes.json();
        if (cfg.razorpayEnabled) {
          const rzpOrderRes = await fetch("/api/payments/razorpay/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderNumber: data.orderNumber }),
          });
          const rzpOrder = await rzpOrderRes.json();
          if (rzpOrderRes.ok) {
            await new Promise((resolve, reject) => {
              if (window.Razorpay) return resolve();
              const s = document.createElement("script");
              s.src = "https://checkout.razorpay.com/v1/checkout.js";
              s.onload = resolve;
              s.onerror = reject;
              document.head.appendChild(s);
            });
            const rzp = new window.Razorpay({
              key: rzpOrder.keyId,
              amount: rzpOrder.amount,
              currency: rzpOrder.currency,
              name: "Janta Optical Centre",
              description: `Order ${data.orderNumber}`,
              order_id: rzpOrder.razorpayOrderId,
              prefill: { name: payload.name, email: payload.email, contact: payload.phone },
              handler: async (response) => {
                await fetch("/api/payments/razorpay/verify", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderNumber: data.orderNumber, ...response }),
                });
                showToast(`Payment verified! Order ${data.orderNumber} confirmed.`);
              },
            });
            rzp.open();
          }
        } else {
          showToast(`Order ${data.orderNumber} saved! Online gateway not yet configured — pay on delivery.`);
        }
      } else {
        showToast(`Order ${data.orderNumber} placed! Total: ${formatINR(data.total)}`);
      }

      cart = [];
      saveCart();
      renderCart();
      checkoutModal?.classList.remove("active");
      checkoutForm.reset();
      selectedRxFile = null;
      if (rxFileInput) rxFileInput.value = "";
      if (rxFilePreview) {
        rxFilePreview.classList.add("hidden");
        rxFilePreview.innerHTML = "";
      }
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Place Order";
    }
  });

  // Order Tracking Modal
  function openTrackModal(e) {
    if (e) e.preventDefault();
    trackOrderResult?.classList.add("hidden");
    trackOrderModal?.classList.add("active");
  }
  document.getElementById("openTrackOrderNav")?.addEventListener("click", openTrackModal);
  document.getElementById("footerTrackOrder")?.addEventListener("click", openTrackModal);
  document.getElementById("mobileTrackChip")?.addEventListener("click", openTrackModal);
  document.getElementById("mobileTrackLink")?.addEventListener("click", (e) => {
    closeMobileMenu();
    openTrackModal(e);
  });
  trackOrderClose?.addEventListener("click", () => trackOrderModal?.classList.remove("active"));

  trackOrderForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const orderNumber = document.getElementById("trackOrderNumber").value.trim();
    const phone = document.getElementById("trackOrderPhone").value.trim();
    if (!trackOrderResult) return;

    trackOrderResult.classList.remove("hidden");
    trackOrderResult.innerHTML = "<p>Checking order status...</p>";

    try {
      const res = await fetch(
        `/api/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`
      );
      const data = await res.json();
      if (!res.ok) {
        trackOrderResult.innerHTML = `<p class="track-error">${escapeHtml(data.error || "Order not found")}</p>`;
        return;
      }
      trackOrderResult.innerHTML = `
        <div class="track-card">
          <div class="track-row"><span>Order #</span><strong>${escapeHtml(data.orderNumber)}</strong></div>
          <div class="track-row"><span>Status</span><span class="status-badge">${escapeHtml(data.status.toUpperCase())}</span></div>
          <div class="track-row"><span>Customer</span><span>${escapeHtml(data.customerName)}</span></div>
          <div class="track-row"><span>Total</span><strong>${formatINR(data.total)}</strong></div>
          <div style="margin-top:12px;text-align:right;">
            <a href="/invoice.html?orderNumber=${encodeURIComponent(data.orderNumber)}&phone=${encodeURIComponent(phone)}" target="_blank" rel="noopener" style="color:var(--accent-hover);font-weight:600;font-size:13px;">View / Print Tax Invoice →</a>
          </div>
        </div>
      `;
    } catch {
      trackOrderResult.innerHTML = `<p class="track-error">Network error. Please try again.</p>`;
    }
  });

  // Mobile Menu & Bottom Nav
  const navToggle = document.getElementById("navToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenuClose = document.getElementById("mobileMenuClose");

  function closeMobileMenu() {
    mobileMenu?.classList.remove("open");
    mobileMenuOverlay?.classList.remove("open");
    document.body.style.overflow = "";
  }

  navToggle?.addEventListener("click", () => {
    mobileMenu?.classList.add("open");
    mobileMenuOverlay?.classList.add("open");
    document.body.style.overflow = "hidden";
  });
  mobileMenuClose?.addEventListener("click", closeMobileMenu);
  mobileMenuOverlay?.addEventListener("click", closeMobileMenu);
  document.querySelectorAll(".mobile-link").forEach((l) => l.addEventListener("click", closeMobileMenu));

  document.getElementById("mobileCartNav")?.addEventListener("click", (e) => {
    e.preventDefault();
    openCart();
  });
  document.getElementById("mobileMenuNav")?.addEventListener("click", (e) => {
    e.preventDefault();
    mobileMenu?.classList.add("open");
    mobileMenuOverlay?.classList.add("open");
  });

  // Global Escape key closes active overlays
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeProductModal();
      closeCart();
      closeMobileMenu();
      checkoutModal?.classList.remove("active");
      trackOrderModal?.classList.remove("active");
    }
  });

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile Animated Promo Carousel
  const promoTrack = document.getElementById("promoTrack");
  const promoDots = document.querySelectorAll("#promoDots .promo-dot");
  if (promoTrack && promoDots.length > 0) {
    let promoIdx = 0;
    const totalSlides = promoDots.length;

    function goToSlide(idx) {
      promoIdx = (idx + totalSlides) % totalSlides;
      promoTrack.style.transform = `translateX(-${promoIdx * 100}%)`;
      promoDots.forEach((d, i) => d.classList.toggle("active", i === promoIdx));
    }

    let promoTimer = setInterval(() => goToSlide(promoIdx + 1), 4000);
    promoDots.forEach((dot) => {
      dot.addEventListener("click", () => {
        clearInterval(promoTimer);
        goToSlide(Number(dot.dataset.slide));
        promoTimer = setInterval(() => goToSlide(promoIdx + 1), 4000);
      });
    });

    let touchStartX = 0;
    promoTrack.addEventListener("touchstart", (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    promoTrack.addEventListener("touchend", (e) => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 40) {
        clearInterval(promoTimer);
        goToSlide(diff > 0 ? promoIdx + 1 : promoIdx - 1);
        promoTimer = setInterval(() => goToSlide(promoIdx + 1), 4000);
      }
    }, { passive: true });
  }

  // Initialize
  loadCart();
  renderCart();
  fetchProducts();
});
