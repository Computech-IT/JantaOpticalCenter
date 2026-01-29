/***********************
  GLOBAL STATE
************************/
let products = [];
const cart = []; // array of {product, quantity}

/***********************
  DOM REFERENCES
************************/
const grid = document.getElementById("productGrid");
const cartDrawer = document.getElementById("cartDrawer");
const cartItems = document.getElementById("cartItems");
const cartEmpty = document.getElementById("cartEmpty");
const cartSummary = document.getElementById("cartSummary");
const floatingCount = document.getElementById("floatingCount");
const backdrop = document.getElementById("backdrop");

/***********************
  PRODUCT MODAL
************************/
const productModal = document.getElementById("productModal");
const modalImg = document.getElementById("modalImg");
const modalTitle = document.getElementById("modalTitle");
const modalDesc = document.getElementById("modalDesc");
const modalPrice = document.getElementById("modalPrice");
const modalAdd = document.getElementById("modalAdd");
const modalClose = document.getElementById("modalClose");

let activeProduct = null;

/***********************
  LOAD PRODUCTS
************************/
fetch("/api/products")
  .then(res => {
    if (!res.ok) {
      console.warn(`API returned ${res.status}, trying JSON fallback...`);
      throw new Error("API failed");
    }
    return res.json();
  })
  .then(data => {
    console.log('Loaded products from API:', data.length, 'items');
    products = data;
    renderProducts();
  })
  .catch(err => {
    console.warn('API fetch failed:', err.message, '- falling back to JSON');
    fetch("/data/products.json")
      .then(r => r.json())
      .then(data => {
        console.log('Loaded products from JSON:', data.length, 'items');
        products = data;
        renderProducts();
      })
      .catch(err => {
        console.error('JSON fallback also failed:', err.message);
        products = [{
          id: 1,
          name: "Sample Frame",
          price: 1999,
          desc: "Premium optical frame",
          img: "https://source.unsplash.com/800x800/?glasses"
        }];
        renderProducts();
      });
  });

/***********************
  RENDER PRODUCTS
************************/
function renderProducts() {
  grid.innerHTML = "";

  products.forEach(p => {
    grid.innerHTML += `
      <div class="tw-product-card bg-white rounded-xl shadow-sm overflow-hidden" data-id="${p.id}">
        <div class="relative">
          <img src="${p.img}" alt="${p.name}" class="w-full h-64 object-cover cursor-pointer product-image" data-id="${p.id}" />
          <div class="tw-overlay absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 hover:opacity-100 transition flex items-end p-4">
            <button class="tw-overlay-quick bg-white px-3 py-2 rounded text-sm" data-id="${p.id}">Quick View</button>
          </div>
        </div>
        <div class="p-4">
          <h4 class="font-semibold text-lg">${p.name}</h4>
          <p class="text-sm text-gray-500 mt-2">${p.desc || ""}</p>
          <div class="mt-4 flex justify-between items-center">
            <span class="text-xl font-bold text-blue-600">₹${p.price}</span>
            <button class="tw-add-to-cart bg-gradient-to-r from-blue-500 to-yellow-400 text-white px-4 py-2 rounded" data-id="${p.id}">
              Add
            </button>
          </div>
        </div>
      </div>
    `;
  });

  // Add click handlers to product images
  document.querySelectorAll(".product-image").forEach(img => {
    img.addEventListener("click", e => {
      const id = Number(e.currentTarget.dataset.id);
      const product = products.find(p => p.id === id);
      if (product) {
        console.log("Opening product modal for:", product.name);
        openProductModal(product);
      }
    });
  });

  // Add click handlers to quick view buttons
  document.querySelectorAll(".tw-overlay-quick").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = Number(e.currentTarget.dataset.id);
      const product = products.find(p => p.id === id);
      if (product) {
        console.log("Opening product modal for:", product.name);
        openProductModal(product);
      }
    });
  });

  document.querySelectorAll(".tw-add-to-cart").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = Number(e.currentTarget.dataset.id);
      const product = products.find(p => p.id === id);
      if (product) addToCart(product);
    });
  });
}

/***********************
  IMAGE CLICK → MODAL
************************/
document.addEventListener("click", e => {
  // Check if clicked on product image or quick view button
  const card = e.target.closest(".tw-product-card");
  if (!card) return;

  const isImage = e.target.tagName === "IMG";
  const isQuickView = e.target.classList.contains("tw-overlay-quick");

  if (!isImage && !isQuickView) return;

  const id = Number(card.dataset.id);
  const product = products.find(p => p.id === id);
  if (!product) return;

  openProductModal(product);
});

/***********************
  OPEN / CLOSE MODAL
************************/
function openProductModal(p) {
  activeProduct = p;
  modalImg.src = p.img;
  modalTitle.textContent = p.name;
  modalDesc.textContent = p.desc || "";
  modalPrice.textContent = `₹${p.price}`;

  productModal.classList.add("active");
  backdrop.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeProductModal() {
  productModal.classList.remove("active");
  backdrop.classList.remove("active");
  modalImg.classList.remove("zoomed");
  modalImg.style.transform = "scale(1)";
  document.body.style.overflow = "";
}

modalClose.addEventListener("click", closeProductModal);
productModal.addEventListener("click", e => {
  if (e.target === productModal) closeProductModal();
});

/***********************
  MODAL IMAGE ZOOM
************************/
modalImg.addEventListener("click", e => {
  e.stopPropagation();
  modalImg.classList.toggle("zoomed");
  modalImg.style.transform = modalImg.classList.contains("zoomed")
    ? "scale(1.8)"
    : "scale(1)";
});

/***********************
  ADD TO CART
************************/
modalAdd.addEventListener("click", () => {
  if (activeProduct) addToCart(activeProduct);
  closeProductModal();
});

function addToCart(product) {
  const existing = cart.find(item => item.product.id === product.id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ product, quantity: 1 });
  }
  updateCartUI();
  showToast(`${product.name} added to cart`);
}

/***********************
  CART UI
************************/
function updateCartUI() {
  cartItems.innerHTML = "";

  if (cart.length === 0) {
    cartEmpty.style.display = "flex";
    cartSummary.style.display = "none";
    floatingCount.innerText = "0";
    return;
  }

  cartEmpty.style.display = "none";
  cartSummary.style.display = "block";

  let totalQuantity = 0;
  let totalPrice = 0;

  cart.forEach((item, i) => {
    const { product, quantity } = item;
    const itemTotal = product.price * quantity;
    totalQuantity += quantity;
    totalPrice += itemTotal;

    cartItems.innerHTML += `
      <div class="p-4 hover:bg-gray-50 transition border-b flex justify-between items-center">
        <div class="flex-1">
          <p class="font-semibold text-gray-900">${product.name}</p>
          <p class="text-sm text-gray-600 mt-1">₹${product.price} × ${quantity} = ₹${itemTotal}</p>
        </div>
        <div class="flex items-center gap-2">
          <button class="qty-minus w-8 h-8 rounded-full bg-gray-200 hover:bg-red-300 text-gray-700 font-bold text-center transition" data-index="${i}" data-action="minus">−</button>
          <span class="qty-val w-6 text-center font-semibold text-gray-900">${quantity}</span>
          <button class="qty-plus w-8 h-8 rounded-full bg-blue-200 hover:bg-blue-400 text-blue-700 font-bold text-center transition" data-index="${i}" data-action="plus">+</button>
          <button class="text-red-500 hover:text-red-700 text-sm ml-2 cart-remove" data-index="${i}">Remove</button>
        </div>
      </div>
    `;
  });

  // Quantity controls
  document.querySelectorAll(".qty-plus, .qty-minus").forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.index);
      const action = btn.dataset.action;
      if (action === "plus") {
        cart[idx].quantity++;
      } else if (action === "minus") {
        if (cart[idx].quantity > 1) {
          cart[idx].quantity--;
        } else {
          cart.splice(idx, 1);
        }
      }
      updateCartUI();
    };
  });

  // Remove button
  document.querySelectorAll(".cart-remove").forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.index);
      cart.splice(idx, 1);
      updateCartUI();
    };
  });

  document.getElementById("totalItems").innerText = totalQuantity;
  document.getElementById("totalPrice").innerText = "₹" + totalPrice;
  floatingCount.innerText = totalQuantity;
}

/***********************
  CART OPEN / CLOSE
************************/
document.getElementById("floatingCart").onclick = () => {
  cartDrawer.classList.add("open");
  backdrop.classList.add("active");
};

document.getElementById("cart-close").onclick = closeCart;

function closeCart() {
  cartDrawer.classList.remove("open");
  backdrop.classList.remove("active");
}

/***********************
  BACKDROP
************************/
backdrop.addEventListener("click", () => {
  closeCart();
  closeProductModal();
  closeCheckout();
});

/***********************
  WHATSAPP / EMAIL
************************/
document.getElementById("whatsappOrder").onclick = () => {
  if (!cart.length) return alert("Cart is empty");
  let msg = "Hello Janta Optical Centre,%0A%0AOrder:%0A";
  cart.forEach(item => msg += `• ${item.product.name} (x${item.quantity}) - ₹${item.product.price * item.quantity}%0A`);
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  msg += `%0ATotal: ₹${total}`;
  window.open(`https://wa.me/918768837581?text=${msg}`, "_blank");
};

document.getElementById("emailOrder").onclick = () => {
  if (!cart.length) return alert("Cart is empty");
  let body = "Order:%0A";
  cart.forEach(item => body += `• ${item.product.name} (x${item.quantity}) - ₹${item.product.price * item.quantity}%0A`);
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  body += `%0ATotal: ₹${total}`;
  window.location =
    `mailto:support@jantaoptical.com?subject=New Order&body=${body}`;
};

/***********************
  TOAST
************************/
function showToast(text) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  document.getElementById("toasts").appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/***********************
  CHECKOUT MODAL
************************/
const checkoutModal = document.getElementById("checkoutModal");
const checkoutStep1 = document.getElementById("checkoutStep1");
const checkoutStep2 = document.getElementById("checkoutStep2");
const checkoutStep3 = document.getElementById("checkoutStep3");
const checkoutForm = document.getElementById("checkoutForm");
const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const customerEmail = document.getElementById("customerEmail");
const customerAddress = document.getElementById("customerAddress");
const customerNotes = document.getElementById("customerNotes");

// Checkout step navigation
document.getElementById("checkoutNext").onclick = () => {
  // Validate form
  if (!customerName.value.trim()) {
    alert("Please enter your name");
    return;
  }
  if (!customerPhone.value.trim()) {
    alert("Please enter your phone number");
    return;
  }
  if (!customerAddress.value.trim()) {
    alert("Please enter your address");
    return;
  }

  // Move to step 2
  checkoutStep1.classList.add("hidden");
  checkoutStep2.classList.remove("hidden");
  
  // Update step indicators
  document.querySelectorAll(".step-indicator").forEach((el, idx) => {
    if (idx === 0) {
      el.classList.remove("active");
      el.classList.add("bg-gray-200", "text-gray-600");
      el.classList.remove("bg-blue-600", "text-white");
    } else if (idx === 1) {
      el.classList.add("active");
      el.classList.add("bg-blue-600", "text-white");
      el.classList.remove("bg-gray-200", "text-gray-600");
    }
  });
  
  // Populate step 2 with order summary
  populateOrderSummary();
};

document.getElementById("checkoutBack").onclick = () => {
  checkoutStep2.classList.add("hidden");
  checkoutStep1.classList.remove("hidden");
  
  document.querySelectorAll(".step-indicator").forEach((el, idx) => {
    if (idx === 0) {
      el.classList.add("active");
      el.classList.add("bg-blue-600", "text-white");
      el.classList.remove("bg-gray-200", "text-gray-600");
    } else if (idx === 1) {
      el.classList.remove("active");
      el.classList.remove("bg-blue-600", "text-white");
      el.classList.add("bg-gray-200", "text-gray-600");
    }
  });
};

document.getElementById("checkoutConfirm").onclick = () => {
  if (!cart.length) {
    alert("Cart is empty");
    return;
  }
  
  // Prepare order data
  const orderData = {
    customer_name: customerName.value,
    phone: customerPhone.value,
    email: customerEmail.value,
    address: customerAddress.value,
    notes: customerNotes.value,
    items_json: JSON.stringify(cart.map(item => ({
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity
    }))),
    total: cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  };

  // Submit order to backend
  fetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderData)
  })
  .then(res => {
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    return res.json();
  })
  .then(data => {
    // Move to step 3 (success)
    checkoutStep2.classList.add("hidden");
    checkoutStep3.classList.remove("hidden");
    
    // Display order ID
    document.getElementById("orderId").innerText = data.id || "ORDER-" + Date.now();
    
    // Clear cart
    cart.length = 0;
    updateCartUI();
  })
  .catch(err => {
    console.error("Order submission failed:", err);
    alert("Failed to place order. Please try again or use WhatsApp/Email.");
  });
};

document.getElementById("checkoutDone").onclick = () => {
  closeCheckout();
};

document.getElementById("checkoutCancel").onclick = () => {
  closeCheckout();
};

document.getElementById("checkoutClose").onclick = () => {
  closeCheckout();
};

function closeCheckout() {
  checkoutModal.classList.remove("open");
  backdrop.classList.remove("active");
  
  // Reset to step 1
  checkoutStep1.classList.remove("hidden");
  checkoutStep2.classList.add("hidden");
  checkoutStep3.classList.add("hidden");
  
  // Reset form
  checkoutForm.reset();
  
  // Reset step indicators
  document.querySelectorAll(".step-indicator").forEach((el, idx) => {
    if (idx === 0) {
      el.classList.add("active");
      el.classList.add("bg-blue-600", "text-white");
      el.classList.remove("bg-gray-200", "text-gray-600");
    } else if (idx === 1) {
      el.classList.remove("active");
      el.classList.remove("bg-blue-600", "text-white");
      el.classList.add("bg-gray-200", "text-gray-600");
    }
  });
}

function populateOrderSummary() {
  const summaryDiv = document.getElementById("orderSummaryItems");
  const subtotalEl = document.getElementById("orderSubtotal");
  const totalEl = document.getElementById("orderTotal");
  const deliveryEl = document.getElementById("deliveryAddr");
  
  summaryDiv.innerHTML = "";
  let subtotal = 0;
  
  cart.forEach(item => {
    const itemTotal = item.product.price * item.quantity;
    subtotal += itemTotal;
    
    const itemEl = document.createElement("div");
    itemEl.className = "flex justify-between items-center border-b border-gray-200 pb-2";
    itemEl.innerHTML = `
      <div>
        <p class="font-semibold text-gray-900">${item.product.name}</p>
        <p class="text-sm text-gray-600">₹${item.product.price} × ${item.quantity}</p>
      </div>
      <p class="font-bold text-gray-900">₹${itemTotal}</p>
    `;
    summaryDiv.appendChild(itemEl);
  });
  
  subtotalEl.innerText = "₹" + subtotal;
  totalEl.innerText = "₹" + subtotal; // FREE delivery, so total = subtotal
  deliveryEl.innerText = customerAddress.value;
}

// Link checkout button in cart drawer
document.getElementById("checkoutBtn").onclick = () => {
  closeCart();
  checkoutModal.classList.add("open");
  backdrop.classList.add("active");
};

/***********************
  FOOTER YEAR
************************/
document.getElementById("year").innerText = new Date().getFullYear();
