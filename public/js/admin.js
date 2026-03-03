document.addEventListener("DOMContentLoaded", () => {
    /* ================================
         STATE
    ================================== */
    let token = localStorage.getItem("admin_token");
    let username = localStorage.getItem("admin_username");
    let allProducts = [];
    let selectedFiles = []; // KEEP ACTUAL FILE OBJECTS

    /* ================================
         ELEMENTS
    ================================== */
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

    const uploadZone = document.getElementById("upload-zone");
    const imageInput = document.getElementById("product-images-input");
    const imagePreview = document.getElementById("image-preview-container");

    const searchInput = document.getElementById("search-product");

    const sidebarItems = document.querySelectorAll(".sidebar-nav .nav-item");
    const sections = {
        products: document.getElementById("section-products"),
        analytics: document.getElementById("section-analytics"),
        settings: document.getElementById("section-settings")
    };

    /* ================================
         IMAGE COMPRESSION UTILITY
    ================================== */
    async function compressImage(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    let width = img.width;
                    let height = img.height;

                    // Max dimensions
                    const maxWidth = 1200;
                    const maxHeight = 1200;

                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress with quality
                    canvas.toBlob(
                        (blob) => {
                            // Create a compressed file
                            const compressedFile = new File([blob], file.name, {
                                type: "image/jpeg",
                                lastModified: Date.now(),
                            });
                            console.log(
                                `Compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`
                            );
                            resolve(compressedFile);
                        },
                        "image/jpeg",
                        0.75 // Quality: 75%
                    );
                };
            };
        });
    }

    /* ================================
         TOAST
    ================================== */
    function showToast(message, type = "success") {
        const container = document.getElementById("toast-container");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    /* ================================
         AUTH LOGIC (UNCHANGED)
    ================================== */
    function showLogin() {
        loginSection.classList.remove("hidden");
        dashboardSection.classList.add("hidden");
    }

    function showDashboard() {
        loginSection.classList.add("hidden");
        dashboardSection.classList.remove("hidden");
        loadProducts();
        if (username) document.getElementById("display-username").textContent = username;
    }

    token ? showDashboard() : showLogin();

    loginForm?.addEventListener("submit", async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById("username").value;
        const passwordInput = document.getElementById("password").value;

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: usernameInput, password: passwordInput })
            });
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { error: `Server Error (${res.status})` };
            }

            if (!res.ok) {
                showToast(data.error || "Login failed", "error");
                return;
            }

            token = data.token;
            username = data.username;
            localStorage.setItem("admin_token", token);
            localStorage.setItem("admin_username", username);

            showToast("Login successful");
            showDashboard();

        } catch {
            showToast("Server error", "error");
        }
    });

    logoutBtn?.addEventListener("click", () => {
        localStorage.clear();
        token = null;
        showLogin();
    });

    /* ================================
         SIDEBAR NAVIGATION
    ================================== */
    sidebarItems.forEach(item => {
        item.addEventListener("click", () => {
            sidebarItems.forEach(i => i.classList.remove("active"));
            item.classList.add("active");

            Object.values(sections).forEach(sec => sec.classList.add("hidden"));

            if (item.id === "nav-products") sections.products.classList.remove("hidden");
            if (item.id === "nav-analytics") sections.analytics.classList.remove("hidden");
            if (item.id === "nav-settings") sections.settings.classList.remove("hidden");
        });
    });

    /* ================================
         LOAD PRODUCTS
    ================================== */
    async function loadProducts() {
        productGrid.innerHTML = "Loading...";
        try {
            const res = await fetch("/api/products");
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                showToast(`Server Error (${res.status})`, "error");
                productGrid.innerHTML = "Error loading products";
                return;
            }
            allProducts = data;
            renderProducts(allProducts);
        } catch {
            showToast("Failed to load products", "error");
        }
    }

    function renderProducts(products) {
        if (!products.length) {
            productGrid.innerHTML = "No products found";
            return;
        }
        productGrid.innerHTML = products.map(p => {
            const imageUrl = p.images?.[0] ? `/images/products/${p.images[0]}` : null;
            return `
      <div class="product-card" style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;">
        <div style="width: 100%; height: 160px; background: #1e293b; display: flex; align-items: center; justify-content: center; overflow: hidden; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
          ${imageUrl ? `<img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="${p.name}" />` : '<i class="fa-solid fa-image" style="font-size: 2.5rem; color: #6366f1;"></i>'}
        </div>
        <div style="padding: 1rem; flex-grow: 1; display: flex; flex-direction: column;">
          <h4 style="font-size: 0.95rem; font-weight: 600; margin: 0 0 0.5rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f8fafc;">${p.name}</h4>
          <p style="font-size: 1.2rem; font-weight: 700; color: #6366f1; margin: 0 0 1rem 0;">₹${p.price}</p>
          <div style="display: flex; gap: 0.5rem; margin-top: auto;">
            <button onclick="editProduct(${p.id})" style="flex: 1; padding: 0.5rem; background: #6366f1; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 0.85rem; transition: 0.2s;">Edit</button>
            <button onclick="deleteProduct(${p.id})" style="flex: 1; padding: 0.5rem; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 0.85rem; transition: 0.2s;">Delete</button>
          </div>
        </div>
      </div>
    `;
        }).join("");
    }

    /* ================================
         MODAL LOGIC
    ================================== */
    openAddBtn?.addEventListener("click", () => {
        productForm.reset();
        productId.value = "";
        selectedFiles = [];
        imagePreview.innerHTML = "";
        imageInput.value = "";
        productModal.classList.remove("hidden");
        productModal.classList.add("active");
    });

    closeModalBtns.forEach(btn => btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        productModal.classList.remove("active");
        productModal.classList.add("hidden");
    }));

    // Clicking outside modal-content closes modal
    const modalContent = productModal.querySelector(".modal-content");
    productModal.addEventListener("click", e => {
        if (e.target === productModal) {
            e.preventDefault();
            e.stopPropagation();
            productModal.classList.remove("active");
            productModal.classList.add("hidden");
        }
    });

    modalContent.addEventListener("click", e => {
        e.stopPropagation();
    });

    /* ================================
         IMAGE UPLOAD + PREVIEW
    ================================== */

    let filePickerActive = false;

    uploadZone.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();

        if (filePickerActive) return;
        filePickerActive = true;

        console.log("Upload zone clicked, triggering file picker");
        imageInput.click();

        setTimeout(() => {
            filePickerActive = false;
        }, 500);
    }, true);

    imageInput.addEventListener("click", e => {
        e.stopPropagation();
    }, true);

    // THIS IS THE KEY EVENT - when user selects files
    imageInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files);

        console.log("File input changed, received files:", files.length);
        files.forEach((f, i) => console.log(`  File ${i}:`, f.name, f.size, f.type));

        // Check total won't exceed 4
        if (selectedFiles.length + files.length > 4) {
            showToast("Maximum 4 images allowed", "error");
            imageInput.value = "";
            return;
        }

        // Show compressing message
        showToast("Compressing images...", "success");

        // ADD FILES TO selectedFiles ARRAY WITH COMPRESSION
        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                console.log("Skipping non-image file:", file.name);
                continue;
            }

            try {
                console.log("Compressing file:", file.name);
                const compressedFile = await compressImage(file);
                console.log("Adding compressed file to selectedFiles:", compressedFile.name);
                selectedFiles.push(compressedFile);
            } catch (err) {
                console.error("Compression error:", err);
                showToast(`Error compressing ${file.name}`, "error");
            }
        }

        console.log("Total selectedFiles after add:", selectedFiles.length);
        showToast("Images compressed and ready!", "success");
        renderPreview();
        imageInput.value = "";
    });

    function renderPreview() {
        console.log("renderPreview called, selectedFiles count:", selectedFiles.length);
        imagePreview.innerHTML = "";
        selectedFiles.forEach((file, index) => {
            const div = document.createElement("div");
            div.className = "preview-item";
            div.style.display = "flex";
            div.style.flexDirection = "column";
            div.style.alignItems = "center";
            div.style.justifyContent = "center";
            div.style.background = "#1e293b";
            div.style.borderRadius = "8px";
            div.style.position = "relative";

            const icon = document.createElement("i");
            icon.className = "fa-solid fa-image";
            icon.style.fontSize = "2rem";
            icon.style.color = "#6366f1";
            icon.style.marginBottom = "8px";

            const fileName = document.createElement("p");
            fileName.textContent = file.name;
            fileName.style.fontSize = "0.7rem";
            fileName.style.color = "#94a3b8";
            fileName.style.textAlign = "center";
            fileName.style.wordBreak = "break-all";
            fileName.style.padding = "4px";
            fileName.style.margin = "0";

            const fileSize = document.createElement("p");
            fileSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)}MB`;
            fileSize.style.fontSize = "0.65rem";
            fileSize.style.color = "#64748b";
            fileSize.style.margin = "4px 0 0 0";

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.textContent = "×";
            removeBtn.style.position = "absolute";
            removeBtn.style.top = "4px";
            removeBtn.style.right = "4px";
            removeBtn.style.width = "24px";
            removeBtn.style.height = "24px";
            removeBtn.style.background = "#ef4444";
            removeBtn.style.color = "white";
            removeBtn.style.border = "none";
            removeBtn.style.borderRadius = "50%";
            removeBtn.style.cursor = "pointer";
            removeBtn.style.fontSize = "16px";
            removeBtn.style.padding = "0";
            removeBtn.style.display = "flex";
            removeBtn.style.alignItems = "center";
            removeBtn.style.justifyContent = "center";
            removeBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                removeImage(index);
            };

            div.appendChild(icon);
            div.appendChild(fileName);
            div.appendChild(fileSize);
            div.appendChild(removeBtn);
            imagePreview.appendChild(div);
        });
    }

    window.removeImage = function (index) {
        console.log("Removing image at index:", index);
        selectedFiles.splice(index, 1);
        renderPreview();
    };

    /* ================================
         SAVE PRODUCT (MULTIPLE IMAGES)
    ================================== */
    productForm.addEventListener("submit", async e => {
        e.preventDefault();
        const id = productId.value;
        const isEdit = id !== "";

        console.log("=== FORM SUBMISSION ===");
        console.log("Product ID:", id || "NEW");
        console.log("Name:", productName.value);
        console.log("Price:", productPrice.value);
        console.log("Description:", productDesc.value);
        console.log("Selected files count:", selectedFiles.length);
        selectedFiles.forEach((f, i) => console.log(`  File ${i}:`, f.name, f.size));

        const formData = new FormData();
        formData.append("name", productName.value.trim());
        formData.append("price", productPrice.value);
        formData.append("description", productDesc.value.trim());

        // ADD FILES TO FORMDATA
        selectedFiles.forEach((file, index) => {
            console.log(`Appending to FormData at index ${index}:`, file.name, `(${(file.size / 1024 / 1024).toFixed(2)}MB)`);
            formData.append("images", file);
        });

        const url = isEdit ? `/api/admin/products/${id}` : "/api/admin/products";
        const method = isEdit ? "PUT" : "POST";

        console.log("Sending to:", url, "Method:", method);

        try {
            showToast("Uploading images...", "success");
            const res = await fetch(url, {
                method,
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { error: `Server Error (${res.status})` };
            }

            console.log("Response status:", res.status);
            console.log("Response data:", data);

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
            imageInput.value = "";
            loadProducts();
        } catch (err) {
            console.error("Fetch error:", err);
            showToast("Server error", "error");
        }
    });

    /* ================================
         SEARCH PRODUCTS
    ================================== */
    searchInput?.addEventListener("input", e => {
        const val = e.target.value.toLowerCase();
        renderProducts(allProducts.filter(p => p.name.toLowerCase().includes(val)));
    });

    /* ================================
         EDIT / DELETE PRODUCT
    ================================== */
    window.editProduct = function (id) {
        const product = allProducts.find(p => p.id === id);
        if (!product) return;

        productId.value = product.id;
        productName.value = product.name;
        productPrice.value = product.price;
        productDesc.value = product.description || "";

        // Don't pre-load images for editing - user must select new ones
        selectedFiles = [];
        imageInput.value = "";
        imagePreview.innerHTML = "";

        productModal.classList.remove("hidden");
        productModal.classList.add("active");
    };

    window.deleteProduct = async function (id) {
        if (!confirm("Delete this product?")) return;
        try {
            const res = await fetch(`/api/admin/products/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            const text = await res.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                data = { error: `Server Error (${res.status})` };
            }
            if (!res.ok) {
                showToast(data.error || "Delete failed", "error");
                return;
            }
            showToast("Product deleted");
            loadProducts();
        } catch {
            showToast("Server error", "error");
        }
    };
});