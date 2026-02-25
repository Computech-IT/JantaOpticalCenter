/* --- Admin Dashboard Javascript Logic --- */

document.addEventListener('DOMContentLoaded', () => {

    // --- Elements ---
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const displayUsername = document.getElementById('display-username');

    const productsGrid = document.getElementById('products-grid');
    const productsLoader = document.getElementById('products-loader');
    const searchProduct = document.getElementById('search-product');

    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');
    const modalTitle = document.getElementById('modal-title');
    const openAddModalBtn = document.getElementById('open-add-modal-btn');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    const productImagesInput = document.getElementById('product-images-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    // Section Nav Elements
    const navProducts = document.getElementById('nav-products');
    const navAnalytics = document.getElementById('nav-analytics');
    const navSettings = document.getElementById('nav-settings');
    const sections = document.querySelectorAll('.admin-section');
    const navItems = document.querySelectorAll('.nav-item');
    const topSearchBar = document.getElementById('top-search-bar');

    // Analytics Elements
    const statOrders = document.getElementById('stat-orders');
    const statRevenue = document.getElementById('stat-revenue');
    const statProducts = document.getElementById('stat-products');
    const ordersList = document.getElementById('orders-list');

    // Settings Elements
    const changePasswordForm = document.getElementById('change-password-form');

    // Form inputs
    const idInput = document.getElementById('product-id');
    const nameInput = document.getElementById('product-name');
    const priceInput = document.getElementById('product-price');
    const descInput = document.getElementById('product-desc');

    // State
    let token = localStorage.getItem('admin_token');
    let currentUsername = localStorage.getItem('admin_username');
    let products = [];
    let currentBase64Images = [];

    // --- Initialization ---
    if (token) {
        showDashboard();
    } else {
        showLogin();
    }

    // --- Navigation ---
    function switchSection(sectionId, navElement) {
        sections.forEach(s => s.classList.add('hidden'));
        document.getElementById(`section-${sectionId}`).classList.remove('hidden');

        navItems.forEach(n => n.classList.remove('active'));
        navElement.classList.add('active');

        // Hide search bar on non-product pages
        if (sectionId === 'products') {
            topSearchBar.style.visibility = 'visible';
            openAddModalBtn.style.display = 'block';
        } else {
            topSearchBar.style.visibility = 'hidden';
            openAddModalBtn.style.display = 'none';
        }

        if (sectionId === 'analytics') fetchAnalytics();
    }

    navProducts.onclick = (e) => { e.preventDefault(); switchSection('products', navProducts); };
    navAnalytics.onclick = (e) => { e.preventDefault(); switchSection('analytics', navAnalytics); };
    navSettings.onclick = (e) => { e.preventDefault(); switchSection('settings', navSettings); };

    // --- Image Upload Helpers ---
    if (productImagesInput) {
        productImagesInput.addEventListener('change', handleImageUpload);
    }

    async function handleImageUpload(e) {
        const files = Array.from(e.target.files);
        for (const file of files) {
            const base64 = await convertToBase64(file);
            currentBase64Images.push(base64);
        }
        renderPreviews();
        productImagesInput.value = ''; // Reset input so same file can be selected again
    }

    function convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    function renderPreviews() {
        imagePreviewContainer.innerHTML = '';
        currentBase64Images.forEach((img, index) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            const imgSrc = img.startsWith('data:') || img.startsWith('http') ? img : 'images/products/' + img;
            div.innerHTML = `
                <img src="${imgSrc}" alt="Preview">
                <button type="button" class="remove-preview" onclick="removeImage(${index})">&times;</button>
            `;
            imagePreviewContainer.appendChild(div);
        });
    }

    window.removeImage = (index) => {
        currentBase64Images.splice(index, 1);
        renderPreviews();
    };

    // --- Auth Handlers ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const btn = document.getElementById('login-btn');

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                token = data.token;
                currentUsername = data.username;
                localStorage.setItem('admin_token', token);
                localStorage.setItem('admin_username', currentUsername);
                showToast('Login successful!', 'success');
                showDashboard();
            } else {
                showToast(data.error || 'Login failed', 'error');
            }
        } catch (err) {
            showToast('Server error during login', 'error');
        } finally {
            btn.innerHTML = '<span>Login</span> <i class="fa-solid fa-arrow-right"></i>';
            btn.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_username');
        token = null;
        showToast('Logged out successfully', 'success');
        showLogin();
    });

    // --- View Switchers ---
    function showLogin() {
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
    }

    function showDashboard() {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        displayUsername.textContent = currentUsername || 'Admin';
        fetchProducts();
    }

    // --- API Handlers ---
    async function fetchProducts() {
        productsGrid.innerHTML = '<div class="loader-container"><div class="spinner"></div></div>';
        try {
            const res = await fetch('/api/products');
            if (res.ok) {
                products = await res.json();
                renderProducts(products);
            } else {
                showToast('Failed to load products', 'error');
            }
        } catch (err) {
            showToast('Error connecting to server', 'error');
        }
    }

    async function fetchAnalytics() {
        try {
            const res = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const stats = await res.json();
            statOrders.textContent = stats.totalOrders;
            statRevenue.textContent = `₹${(stats.totalRevenue || 0).toLocaleString()}`;
            statProducts.textContent = stats.totalProducts;

            const ordersRes = await fetch('/api/admin/orders', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const orders = await ordersRes.json();
            renderOrders(orders);
        } catch (err) {
            showToast('Failed to fetch analytics', 'error');
        }
    }

    function renderOrders(orders) {
        if (!orders || orders.length === 0) {
            ordersList.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No orders yet.</td></tr>';
            return;
        }
        ordersList.innerHTML = orders.map(o => `
            <tr>
              <td>#${o.id}</td>
              <td>
                <div style="font-weight: 500;">${o.customer_name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${o.phone}</div>
              </td>
              <td style="font-weight: 600; color: var(--primary-color);">₹${o.total}</td>
              <td>${new Date(o.created_at).toLocaleDateString()}</td>
              <td>${o.items.length} items</td>
            </tr>
        `).join('');
    }

    async function saveProduct(productData) {
        const isUpdate = productData.id !== '';
        const url = isUpdate ? `/api/admin/products/${productData.id}` : '/api/admin/products';
        const method = isUpdate ? 'PUT' : 'POST';

        const btn = document.getElementById('save-product-btn');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(productData)
            });

            const data = await res.json();
            if (res.ok) {
                showToast(isUpdate ? 'Product updated successfully' : 'Product created successfully', 'success');
                closeModal();
                fetchProducts(); // Refresh list
            } else {
                if (res.status === 401 || res.status === 403) {
                    showToast('Session expired. Please log in again.', 'error');
                    logoutBtn.click();
                } else {
                    showToast(data.error || 'Failed to save product', 'error');
                }
            }
        } catch (err) {
            showToast('Error communicating with server', 'error');
        } finally {
            btn.innerHTML = 'Save Product';
            btn.disabled = false;
        }
    }

    async function deleteProduct(id) {
        if (!confirm('Are you sure you want to delete this product?')) return;

        try {
            const res = await fetch(`/api/admin/products/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                showToast('Product deleted', 'success');
                fetchProducts(); // Refresh list
            } else {
                showToast('Failed to delete product', 'error');
            }
        } catch (err) {
            showToast('Error deleting product', 'error');
        }
    }

    // Change Password Handler
    changePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;

        try {
            const res = await fetch('/api/admin/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await res.json();
            if (res.ok) {
                showToast('Password changed successfully', 'success');
                changePasswordForm.reset();
            } else {
                showToast(data.error || 'Failed to change password', 'error');
            }
        } catch (err) {
            showToast('Network error', 'error');
        }
    });

    // --- UI Renderers ---
    function renderProducts(items) {
        if (items.length === 0) {
            productsGrid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">No products found.</p>';
            return;
        }

        productsGrid.innerHTML = items.map(p => {
            const images = p.images || [];
            const mainImg = images[0] || '';
            const imgSrc = mainImg ? (mainImg.startsWith('http') || mainImg.startsWith('data:') ? mainImg : `images/products/${mainImg}`) : null;
            const imgHtml = imgSrc ? `<img src="${imgSrc}" class="product-img" alt="${p.name}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100\\' height=\\'100\\'><rect fill=\\'%231e293b\\' width=\\'100%\\' height=\\'100%\\'/><text fill=\\'%2394a3b8\\' x=\\'50%\\' y=\\'50%\\' font-family=\\'Arial\\' font-size=\\'12\\' text-anchor=\\'middle\\' dy=\\'0.3em\\'>Image Not Found</text></svg>'">` : `<div class="product-no-img"><i class="fa-solid fa-image fa-2x"></i></div>`;

            return `
        <div class="product-card">
          ${imgHtml}
          <div class="product-info">
            <h4>${p.name}</h4>
            <div class="product-price">₹${p.price}</div>
            <div class="product-actions">
              <button class="btn-secondary" onclick="window.editProduct(${p.id})">
                <i class="fa-solid fa-pen"></i> Edit
              </button>
              <button class="btn-danger-outline" onclick="window.deleteProductFunc(${p.id})">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
        }).join('');
    }

    // Define global functions for inline onclick handlers
    window.editProduct = (id) => {
        const product = products.find(p => p.id === id);
        if (!product) return;

        modalTitle.textContent = 'Edit Product';
        idInput.value = product.id;
        nameInput.value = product.name;
        priceInput.value = product.price;
        descInput.value = product.desc || '';

        // Handle images
        currentBase64Images = [...(product.images || [])];
        renderPreviews();

        productModal.classList.remove('hidden');
        // slight delay for animation
        setTimeout(() => productModal.classList.add('active'), 10);
    };

    window.deleteProductFunc = deleteProduct;

    // --- Search functionality ---
    searchProduct.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = products.filter(p => p.name.toLowerCase().includes(term));
        renderProducts(filtered);
    });

    // --- Modal Logic ---
    openAddModalBtn.addEventListener('click', () => {
        modalTitle.textContent = 'Add New Product';
        productForm.reset();
        idInput.value = ''; // Ensure ID is empty for new product
        currentBase64Images = [];
        renderPreviews();
        productModal.classList.remove('hidden');
        setTimeout(() => productModal.classList.add('active'), 10);
    });

    function closeModal() {
        productModal.classList.remove('active');
        setTimeout(() => productModal.classList.add('hidden'), 300); // match transition
    }

    closeModalBtns.forEach(btn => btn.addEventListener('click', closeModal));

    productForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const productData = {
            id: idInput.value,
            name: nameInput.value,
            price: Number(priceInput.value),
            description: descInput.value,
            img: JSON.stringify(currentBase64Images) // Send as JSON string for SQLite storage
        };
        saveProduct(productData);
    });

    // --- Toast Notification System ---
    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
        toast.innerHTML = `${icon} <span>${message}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

});
