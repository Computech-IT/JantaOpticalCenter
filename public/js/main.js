/********************************
  MAIN.JS – PREMIUM REWRITE
*********************************/

document.addEventListener("DOMContentLoaded", () => {

  /* =============================
     GLOBAL STATE
  ============================== */
  let products = [];
  let cart = []; // In-memory cart
  let currentModalIndex = 0;

  /* =============================
     DOM REFERENCES
  ============================== */
  const productGrid = document.getElementById("productGrid");

  // Slideshow Modal
  const modal = document.getElementById("imageModal");
  const modalViewer = document.getElementById("modalViewer");
  const modalThumbs = document.getElementById("modalThumbs");
  const modalClose = document.getElementById("modalClose");
  const modalTitle = document.getElementById("modalTitle");
  const modalPrice = document.getElementById("modalPrice");
  const modalAdd = document.getElementById("modalAdd");

  // Cart Drawer
  const cartDrawer = document.getElementById("cartDrawer");
  const openCartBtn = document.getElementById("openCartBtn"); // Navbar cart
  // const floatingCart = document.getElementById("floatingCart"); // Floating cart (if kept)
  const cartClose = document.getElementById("cart-close");
  const backdrop = document.getElementById("backdrop");
  const navCartCount = document.getElementById("navCartCount");
  const cartItemsList = document.getElementById("cartItems");
  const cartEmpty = document.getElementById("cartEmpty");
  const cartSummary = document.getElementById("cartSummary");
  const totalPriceEl = document.getElementById("totalPrice");

  /* =============================
     INIT
  ============================== */
  fetch("/api/products")
    .then(res => {
      if (!res.ok) return res.json().then(err => { throw err; });
      return res.json();
    })
    .then(data => {
      products = data;
      renderProductGrid();
    })
    .catch(err => {
      console.error("Product load failed", err);
      if (productGrid) productGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ef4444; padding: 2rem;">Error: ${err.error || 'Failed to load products'}</p>`;
    });

  /* =============================
     RENDER GRID
  ============================== */
  function renderProductGrid(dataToRender = products) {
    if (!productGrid) return;

    // Safety check: ensure we have an array
    if (!Array.isArray(dataToRender)) {
      console.error("renderProductGrid expected array, got:", dataToRender);
      return;
    }

    productGrid.innerHTML = dataToRender.map(product => {
      const images = (product.images && product.images.length > 0) ? product.images : ['data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'><rect fill=\'%23eee\' width=\'100%\' height=\'100%\'/><text fill=\'%23aaa\' x=\'50%\' y=\'50%\' font-family=\'Arial\' font-size=\'12\' text-anchor=\'middle\' dy=\'0.3em\'>No Image</text></svg>'];

      const getImgSrc = (src) => src.startsWith('http') || src.startsWith('data:') ? src : src.startsWith('images/') ? src : `images/products/${src}`;

      return `
      <div class="product-card" data-id="${product.id}">
        
        <div class="product-image-wrap">
          <img 
            src="${getImgSrc(images[0])}" 
            alt="${product.name}" 
            class="product-image main-img"
          />
          <!-- Overlay Action (Desktop) -->
          <div class="product-overlay">
             <div class="overlay-actions">
               <button data-action="quickview">QUICK VIEW</button>
             </div>
          </div>
        </div>

        <div class="product-thumbnails">
          ${images.map((img, i) => `
            <img 
              src="${getImgSrc(img)}" 
              class="card-thumb ${i === 0 ? "active" : ""}" 
              data-src="${getImgSrc(img)}" 
            />
          `).join("")}
        </div>

        <div class="product-info">
          <h3>${product.name}</h3>
          <p class="price">₹${product.price}</p>
        </div>
        
      </div>
    `;
    }).join("");
  }

  /* =============================
     INTERACTIONS (Delegation)
  ============================== */
  productGrid.addEventListener("click", (e) => {
    const card = e.target.closest(".product-card");
    if (!card) return;

    // 1. Thumbnail Click -> Switch Card Image ONLY (No Modal)
    if (e.target.classList.contains("card-thumb")) {
      e.stopPropagation(); // Stop bubbling
      const src = e.target.dataset.src;
      const mainImg = card.querySelector(".main-img");
      if (mainImg) mainImg.src = src;

      // Update active class
      card.querySelectorAll(".card-thumb").forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
      return;
    }

    // 2. Main Image / QuickView -> Open Modal
    // We check if the click target is the main image wrapper or the quickview button
    if (
      e.target.closest(".product-image-wrap") ||
      e.target.dataset.action === "quickview"
    ) {
      const productId = card.dataset.id;
      const product = products.find(p => p.id == productId);
      if (product) openModal(product);
    }
  });

  // Optional: Hover on thumb switches image too (Desktop convenience)
  productGrid.addEventListener("mouseover", (e) => {
    if (e.target.classList.contains("card-thumb")) {
      const card = e.target.closest(".product-card");
      if (!card) return;
      const src = e.target.dataset.src;
      const mainImg = card.querySelector(".main-img");
      if (mainImg) mainImg.src = src;
      card.querySelectorAll(".card-thumb").forEach(t => t.classList.remove("active"));
      e.target.classList.add("active");
    }
  });

  /* =============================
     MODAL LOGIC
  ============================== */
  function openModal(product) {
    const getImgSrc = (src) => src.startsWith('http') || src.startsWith('data:') ? src : src.startsWith('images/') ? src : `images/products/${src}`;
    const images = (product.images && product.images.length > 0) ? product.images : [''];

    // Populate Modal Info
    modalTitle.textContent = product.name;
    modalPrice.textContent = `₹${product.price}`;

    // Setup Scroller Images
    modalViewer.innerHTML = images.map(img => `
      <div class="slideshow-item">
        <img src="${getImgSrc(img)}" alt="${product.name}" />
      </div>
    `).join("");

    // Setup Thumbs
    modalThumbs.innerHTML = images.map((img, i) => `
      <img 
        src="${getImgSrc(img)}" 
        class="slideshow-thumb ${i === 0 ? "active" : ""}" 
        data-index="${i}"
      />
    `).join("");

    // Reset Scroll
    modalViewer.scrollLeft = 0;

    modal.classList.add("open");
    document.body.style.overflow = "hidden"; // Prevent background scroll

    // Handle Add to Cart from Modal
    modalAdd.onclick = () => {
      addToCart(product);
      showToast("Added to Cart!");
    };
  }

  function closeModal() {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  }

  modalClose.addEventListener("click", closeModal);

  // Click thumb in modal -> Scroll to that image
  modalThumbs.addEventListener("click", (e) => {
    if (e.target.classList.contains("slideshow-thumb")) {
      const index = Number(e.target.dataset.index);
      const width = modalViewer.clientWidth;
      modalViewer.scrollTo({
        left: width * index,
        behavior: 'smooth'
      });
      updateModalThumbs(index);
    }
  });

  // Sync active thumb on scroll
  modalViewer.addEventListener("scroll", () => {
    const index = Math.round(modalViewer.scrollLeft / modalViewer.clientWidth);
    updateModalThumbs(index);
  });

  function updateModalThumbs(index) {
    const thumbs = modalThumbs.querySelectorAll(".slideshow-thumb");
    thumbs.forEach(t => t.classList.remove("active"));
    if (thumbs[index]) thumbs[index].classList.add("active");
  }

  /* =============================
     CART LOGIC (Modern + Qty)
  ============================== */
  const FREE_SHIPPING_THRESHOLD = 999; // Example threshold

  // Load initial cart with qty support
  try {
    const saved = localStorage.getItem("jantaCart");
    if (saved) {
      cart = JSON.parse(saved);
      // Ensure legacy cart items have quantity
      cart.forEach(item => {
        if (!item.qty) item.qty = 1;
      });
    }
  } catch (e) {
    console.error("Cart load error", e);
  }
  updateCartUI(); // Initial render

  function addToCart(product) {
    // Check if item exists
    const existing = cart.find(item => item.id == product.id);
    if (existing) {
      existing.qty++;
      showToast(`Updated Quantity: ${existing.qty}`);
    } else {
      cart.push({ ...product, qty: 1 });
      showToast("Added to Cart");
    }
    saveCart();
    updateCartUI();
    openCart();
  }

  function saveCart() {
    localStorage.setItem("jantaCart", JSON.stringify(cart));
  }

  // Update Item Quantity
  window.updateQty = (index, delta) => {
    if (cart[index]) {
      cart[index].qty += delta;
      if (cart[index].qty <= 0) {
        cart.splice(index, 1); // Remove if 0
      }
      saveCart();
      updateCartUI();
    }
  };

  function updateCartUI() {
    // Calculate totals
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    if (navCartCount) navCartCount.textContent = totalCount;

    if (cart.length === 0) {
      if (cartItemsList) cartItemsList.style.display = 'none';
      if (cartEmpty) cartEmpty.style.display = 'flex';
      if (cartSummary) cartSummary.style.display = 'none';
      if (checkoutBtn) checkoutBtn.style.display = 'none';
    } else {
      if (cartItemsList) {
        cartItemsList.style.display = 'block';
        // Render Items with Controls
        cartItemsList.innerHTML = cart.map((item, index) => {
          const getImgSrc = (src) => src.startsWith('http') || src.startsWith('data:') ? src : src.startsWith('images/') ? src : `images/products/${src}`;
          const mainImgArr = Array.isArray(item.images) ? item.images : (item.img ? JSON.parse(item.img) : []);
          const mainImg = mainImgArr[0] || '';

          return `
            <div class="cart-item">
              <img src="${getImgSrc(mainImg)}" alt="${item.name}">
              <div class="cart-item-details">
                 <h4>${item.name}</h4>
                 <p class="price">₹${item.price}</p>
                 <div class="cart-controls">
                   <button class="qty-btn" onclick="window.updateQty(${index}, -1)">−</button>
                   <span class="qty-val">${item.qty}</span>
                   <button class="qty-btn" onclick="window.updateQty(${index}, 1)">+</button>
                 </div>
              </div>
              <div class="cart-remove">
                 <span class="remove-btn-icon" onclick="window.updateQty(${index}, -9999)" title="Remove">🗑</span>
              </div>
            </div>
          `;
        }).join("");
      }
      if (cartEmpty) cartEmpty.style.display = 'none';
      if (cartSummary) cartSummary.style.display = 'block';
      if (checkoutBtn) checkoutBtn.style.display = 'block';

      // Shipping Bar Logic
      const shippingDiff = FREE_SHIPPING_THRESHOLD - totalPrice;
      let shippingHtml = '';
      if (shippingDiff > 0) {
        shippingHtml = `<div class="shipping-bar">Add <b>₹${shippingDiff}</b> more for <b style="color:#0284c7">Free Shipping</b></div>`;
      } else {
        shippingHtml = `<div class="shipping-bar success">🎉 You've unlocked <b>Free Shipping</b>!</div>`;
      }

      const shipContainer = document.getElementById("shippingContainer");
      if (shipContainer) shipContainer.innerHTML = shippingHtml;

      if (totalPriceEl) totalPriceEl.textContent = `₹${totalPrice}`;
    }
  }

  function openCart() {
    if (cartDrawer) cartDrawer.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
  }

  function closeCart() {
    if (cartDrawer) cartDrawer.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
  }

  if (openCartBtn) openCartBtn.addEventListener("click", openCart);
  if (cartClose) cartClose.addEventListener("click", closeCart);
  if (backdrop) backdrop.addEventListener("click", closeCart);

  // WhatsApp Button
  const whatsappBtn = document.getElementById("whatsappOrder");
  if (whatsappBtn) {
    whatsappBtn.onclick = () => {
      if (cart.length === 0) return showToast("Cart is empty");
      const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      let msg = `*New Order from Janta Optical Website*\n------------------\n`;
      cart.forEach((item, i) => {
        msg += `${i + 1}. ${item.name} (x${item.qty}) - ₹${item.price * item.qty}\n`;
      });
      msg += `------------------\n*Total Order Value: ₹${totalPrice}*\n\nPlease confirm availability.`;
      const phone = "918768837581";
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    };
  }

  // Checkout Logic
  const checkoutBtn = document.getElementById("checkoutBtn");
  const checkoutModal = document.getElementById("checkoutModal");
  const checkoutForm = document.getElementById("checkoutForm");
  const checkoutClose = document.getElementById("checkoutClose");

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      if (cart.length === 0) return showToast("Cart is empty!");
      closeCart();
      checkoutModal.classList.add("active");
    });
  }

  if (checkoutClose) {
    checkoutClose.addEventListener("click", () => checkoutModal.classList.remove("active"));
  }

  if (checkoutForm) {
    checkoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("orderName").value;
      const phone = document.getElementById("orderPhone").value;
      const address = document.getElementById("orderAddress").value;
      const notes = document.getElementById("orderNotes").value;
      const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

      const submitBtn = document.getElementById("confirmOrderBtn");
      submitBtn.disabled = true;
      submitBtn.innerHTML = "Processing...";

      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, phone, address, notes, items: cart, total })
        });
        const data = await res.json();
        if (res.ok) {
          showToast("Order placed successfully!");
          cart = [];
          saveCart();
          updateCartUI();
          checkoutModal.classList.remove("active");
          checkoutForm.reset();
        } else {
          showToast(data.error || "Order failed. Try again.");
        }
      } catch (err) {
        showToast("Error connecting to server.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = "Place Order";
      }
    });
  }

  /* =============================
     TOAST
  ============================== */
  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    document.getElementById("toasts").appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  /* =============================
     INIT OTHER (Mobile Menu)
  ============================== */
  const navToggle = document.getElementById("navToggle");
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileMenuOverlay = document.getElementById("mobileMenuOverlay");
  const mobileMenuClose = document.getElementById("mobileMenuClose");
  const mobileLinks = document.querySelectorAll(".mobile-link");

  function openMobileMenu() {
    mobileMenu.classList.add("open");
    mobileMenuOverlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeMobileMenu() {
    mobileMenu.classList.remove("open");
    mobileMenuOverlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (navToggle) {
    navToggle.addEventListener("click", openMobileMenu);
  }

  if (mobileMenuClose) {
    mobileMenuClose.addEventListener("click", closeMobileMenu);
  }

  if (mobileMenuOverlay) {
    mobileMenuOverlay.addEventListener("click", closeMobileMenu);
  }

  // Close menu when a link is clicked
  mobileLinks.forEach(link => {
    link.addEventListener("click", closeMobileMenu);
  });

  /* =============================
     FILTERING LOGIC (Shop by Shape)
  ============================== */
  const categoryCards = document.querySelectorAll(".category-card");
  categoryCards.forEach(card => {
    card.addEventListener("click", () => {
      const shape = card.getAttribute("data-shape");

      // Remove active class from all
      categoryCards.forEach(c => c.classList.remove("active"));
      // Add active class to clicked
      card.classList.add("active");

      if (shape === "all") {
        renderProductGrid(products);
      } else {
        const filtered = products.filter(p => p.shape === shape);
        renderProductGrid(filtered);
      }

      // Smooth scroll to results
      const resultsSection = document.getElementById("collection");
      if (resultsSection) {
        resultsSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

});
