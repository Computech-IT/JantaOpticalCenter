let products = [];

// load products from API first, fallback to JSON
fetch('/api/products')
  .then(res => {
    if (!res.ok) throw new Error('API products fetch failed');
    return res.json();
  })
  .then(data => { products = data; renderProducts(); })
  .catch(() => {
    fetch('/data/products.json')
      .then(r => r.json())
      .then(data => { products = data; renderProducts(); })
      .catch(err => {
        console.error('Could not fetch products:', err);
        products = [ { id: 0, name: 'Sample Product', price: 0, desc: 'No products available', img: 'https://source.unsplash.com/800x800/?glasses' } ];
        renderProducts();
      });
  });

const cart = [];
const grid = document.getElementById("productGrid");
const cartDrawer = document.getElementById("cartDrawer");
const cartItems = document.getElementById("cartItems");
const cartEmpty = document.getElementById("cartEmpty");
const cartCount = document.getElementById("cart-count");
const cartSummary = document.getElementById("cartSummary");
const backdrop = document.getElementById("backdrop");

function renderProducts() {
  grid.innerHTML = '';
  products.forEach(p => {
    const safe = {
      id: p.id,
      name: p.name.replace(/"/g, '&quot;'),
      price: p.price,
      desc: p.desc || p.description || '',
      img: p.img
    };

    grid.innerHTML += `
      <div class="product-card" data-id="${safe.id}">
        <div style="position:relative;">
          <span class="product-badge">Best</span>
          <img loading="lazy" data-full="${safe.img}" src="${safe.img}" alt="${safe.name}">
          <div class="product-overlay">
            <div class="overlay-actions">
              <button class="btn overlay-quick">Quick View</button>
              <button class="btn overlay-add">Add</button>
            </div>
          </div>
        </div>
        <div class="info">
          <h4>${safe.name}</h4>
          <p>${safe.desc}</p>
          <div class="price">₹${safe.price}</div>
          <button data-id="${safe.id}" class="add-to-cart">Add to Cart</button>
        </div>
      </div>
    `;
  });

  // attach handlers for newly created buttons
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      const product = products.find(p => p.id === id);
      if (product) addToCart(product);
    });
  });

  // product quick view on image click
  document.querySelectorAll('.product-card img').forEach(img => {
    img.addEventListener('click', (e) => {
      const full = e.currentTarget.dataset.full || e.currentTarget.src;
      const card = e.currentTarget.closest('.product-card');
      const id = Number(card.dataset.id);
      const product = products.find(p => p.id === id) || {};
      openProductModal({ img: full, name: product.name, desc: product.desc || product.description, price: product.price, id: product.id });
    });
  });
}

// PRODUCT QUICK VIEW
const productModal = document.getElementById('productModal');
const modalImg = document.getElementById('modalImg');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalPrice = document.getElementById('modalPrice');
const modalAdd = document.getElementById('modalAdd');
let currentModalProduct = null;

function openProductModal(p) {
  currentModalProduct = p;
  modalImg.src = p.img;
  modalImg.alt = p.name || 'Product image';
  modalTitle.innerText = p.name || '';
  modalDesc.innerText = p.desc || '';
  modalPrice.innerText = p.price ? `₹${p.price}` : '';
  productModal.classList.add('open');
  backdrop.classList.add('open');
}

function closeProductModal() {
  productModal.classList.remove('open');
  backdrop.classList.remove('open');
}

document.getElementById('modalClose').addEventListener('click', closeProductModal);
document.getElementById('modalAdd').addEventListener('click', () => {
  if (currentModalProduct) addToCart(currentModalProduct);
  closeProductModal();
});
backdrop.addEventListener('click', () => { closeCart(); closeProductModal(); });

// Attach overlay action handlers (delegated)
document.addEventListener('click', (e) => {
  if (e.target.matches('.overlay-quick')) {
    const card = e.target.closest('.product-card');
    const id = Number(card.dataset.id);
    const product = products.find(p => p.id === id);
    openProductModal({ img: product.img, name: product.name, desc: product.desc || product.description, price: product.price, id: product.id });
  }
  if (e.target.matches('.overlay-add')) {
    const card = e.target.closest('.product-card');
    const id = Number(card.dataset.id);
    const product = products.find(p => p.id === id);
    if (product) addToCart(product);
  }
});

// Checkout modal handlers
const checkoutModal = document.getElementById('checkoutModal');
const checkoutForm = document.getElementById('checkoutForm');
const checkoutClose = document.getElementById('checkoutClose');
const checkoutCancel = document.getElementById('checkoutCancel');
const checkoutConfirm = document.getElementById('checkoutConfirm');

document.getElementById('checkoutBtn').addEventListener('click', () => {
  if (cart.length === 0) {
    alert('Your cart is empty. Add items before checking out.');
    return;
  }
  checkoutModal.classList.add('open');
  backdrop.classList.add('open');
});

// set footer year
document.getElementById('year').innerText = new Date().getFullYear();

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');
if (navToggle) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    if (navLinks.classList.contains('open')) {
      navLinks.style.display = 'flex';
    } else {
      navLinks.style.display = '';
    }
  });

  // close mobile menu when a link is clicked
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navLinks.style.display = '';
  }));
}

function closeCheckout() {
  checkoutModal.classList.remove('open');
  backdrop.classList.remove('open');
}

checkoutClose.addEventListener('click', closeCheckout);
checkoutCancel.addEventListener('click', closeCheckout);

checkoutForm.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const name = document.getElementById('customerName').value;
  const phone = document.getElementById('customerPhone').value;
  const address = document.getElementById('customerAddress').value;
  const notes = document.getElementById('customerNotes').value;

  // build order summary
  let body = `Order from ${name}%0APhone: ${phone}%0AAddress: ${address}%0A%0AItems:%0A`;
  cart.forEach(i => body += `• ${i.name} - ₹${i.price}%0A`);
  const total = cart.reduce((s,it)=>s+it.price,0);
  body += `%0ATotal: ₹${total}%0A%0ANotes: ${notes}`;

  const payload = { name, phone, address, notes, items: cart, total };

  fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(resp => {
    // success: show confirmation
    checkoutForm.style.display = 'none';
    checkoutConfirm.style.display = 'block';
    // clear cart
    cart.length = 0;
    updateCartUI();
  })
  .catch(() => {
    // fallback to email if server not reachable
    window.location = `mailto:jantaoptical@example.com?subject=Order from ${encodeURIComponent(name)}&body=${body}`;
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push({ name, phone, address, notes, items: cart.slice(), total, created: new Date().toISOString() });
    localStorage.setItem('orders', JSON.stringify(orders));
    checkoutForm.style.display = 'none';
    checkoutConfirm.style.display = 'block';
    cart.length = 0;
    updateCartUI();
  });
});

function addToCart(product) {
  cart.push(product);
  updateCartUI();
  // show toast notification and update floating count
  showToast(`${product.name} added to cart`);
  const fc = document.getElementById('floatingCount'); if (fc) fc.innerText = cart.length;
}

// Toast helper
function showToast(message, ms = 2200) {
  const container = document.getElementById('toasts');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerText = message;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; }, ms);
  setTimeout(() => t.remove(), ms + 420);
}

function updateCartUI() {
  if (cartCount) cartCount.innerText = cart.length;
  renderCart();
  
  if (cart.length > 0) {
    cartEmpty.style.display = 'none';
    cartSummary.style.display = 'block';
    updateCartSummary();
  } else {
    cartEmpty.style.display = 'flex';
    cartSummary.style.display = 'none';
  }
}

function renderCart() {
  cartItems.innerHTML = "";
  cart.forEach((item, index) => {
    cartItems.innerHTML += `<p>${item.name} <span>₹${item.price}</span></p>`;
  });
}

function updateCartSummary() {
  const totalItems = cart.length;
  const totalPrice = cart.reduce((sum, item) => sum + item.price, 0);
  
  document.getElementById("totalItems").innerText = totalItems;
  document.getElementById("totalPrice").innerText = `₹${totalPrice}`;
}

function openCart() {
  cartDrawer.classList.add("open");
  backdrop.classList.add("open");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  backdrop.classList.remove("open");
}

const headerCartBtn = document.getElementById("cart-btn");
if (headerCartBtn) headerCartBtn.onclick = openCart;
const cartCloseBtn = document.getElementById("cart-close");
if (cartCloseBtn) cartCloseBtn.onclick = closeCart;
if (backdrop) backdrop.onclick = closeCart;

  // floating cart open
  const floatingCartBtn = document.getElementById('floatingCart');
  const floatingCountEl = document.getElementById('floatingCount');
  if (floatingCartBtn) {
    floatingCartBtn.addEventListener('click', () => {
      openCart();
    });
  }

document.getElementById("whatsappOrder").onclick = () => {
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }
  
  let msg = "Hello Janta Optical Centre,%0A%0AI want to order:%0A%0A";
  cart.forEach(i => msg += `• ${i.name} - ₹${i.price}%0A`);
  
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  msg += `%0ATotal: ₹${total}`;
  
  window.open(`https://wa.me/918768837581?text=${msg}`, "_blank");
};

document.getElementById("emailOrder").onclick = () => {
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }
  
  let body = "I want to order:\n\n";
  cart.forEach(i => body += `• ${i.name} - ₹${i.price}\n`);
  
  const total = cart.reduce((sum, item) => sum + item.price, 0);
  body += `\nTotal: ₹${total}`;
  
  window.location = `mailto:jantaoptical@example.com?subject=New Order from Janta Optical&body=${body}`;
};
