// ============================================
// SEARCH & FILTER FUNCTIONALITY
// ============================================

class ProductFilter {
    constructor() {
        this.allProducts = [];
        this.filteredProducts = [];
        this.filters = {
            searchTerm: '',
            minPrice: 0,
            maxPrice: Infinity,
            sortBy: 'newest' // newest, price-low, price-high, name
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadProducts();
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('filterSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.searchTerm = e.target.value.toLowerCase();
                console.log('Search:', this.filters.searchTerm);
                this.applyFilters();
            });
        }

        // Price range inputs
        const minPriceInput = document.getElementById('filterMinPrice');
        const maxPriceInput = document.getElementById('filterMaxPrice');

        if (minPriceInput) {
            minPriceInput.addEventListener('change', (e) => {
                this.filters.minPrice = parseFloat(e.target.value) || 0;
                console.log('Min price:', this.filters.minPrice);
                this.applyFilters();
            });
        }

        if (maxPriceInput) {
            maxPriceInput.addEventListener('change', (e) => {
                this.filters.maxPrice = parseFloat(e.target.value) || Infinity;
                console.log('Max price:', this.filters.maxPrice);
                this.applyFilters();
            });
        }

        // Sort dropdown
        const sortSelect = document.getElementById('filterSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.filters.sortBy = e.target.value;
                console.log('Sort by:', this.filters.sortBy);
                this.applyFilters();
            });
        }

        // Clear filters button
        const clearBtn = document.getElementById('filterClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearFilters();
            });
        }

        // Close filter panel on mobile
        const closeFilterBtn = document.getElementById('filterCloseBtn');
        if (closeFilterBtn) {
            closeFilterBtn.addEventListener('click', () => {
                this.closeFilterPanel();
            });
        }
    }

    async loadProducts() {
        try {
            const response = await fetch('/api/products');
            const data = await response.json();
            this.allProducts = data;
            this.applyFilters();
        } catch (error) {
            console.error('Error loading products:', error);
            showToast('Failed to load products', 'error');
        }
    }

    applyFilters() {
        console.log('Applying filters...');

        // Start with all products
        let filtered = [...this.allProducts];

        // 1. Filter by search term
        if (this.filters.searchTerm) {
            filtered = filtered.filter(product => {
                const name = product.name.toLowerCase();
                const description = (product.description || '').toLowerCase();
                return name.includes(this.filters.searchTerm) ||
                    description.includes(this.filters.searchTerm);
            });
        }

        // 2. Filter by price range
        filtered = filtered.filter(product => {
            const price = parseFloat(product.price);
            return price >= this.filters.minPrice && price <= this.filters.maxPrice;
        });

        // 3. Sort results
        filtered = this.sortProducts(filtered, this.filters.sortBy);

        this.filteredProducts = filtered;
        console.log('Filtered results:', this.filteredProducts.length, 'products');

        // Update UI
        this.renderProducts();
        this.updateFilterSummary();
    }

    sortProducts(products, sortBy) {
        const sorted = [...products];

        switch (sortBy) {
            case 'price-low':
                return sorted.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

            case 'price-high':
                return sorted.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

            case 'name':
                return sorted.sort((a, b) => a.name.localeCompare(b.name));

            case 'newest':
            default:
                return sorted.reverse(); // Newest first (assuming higher ID = newer)
        }
    }

    renderProducts() {
        const productGrid = document.getElementById('productGrid');

        if (!productGrid) {
            console.warn('Product grid not found');
            return;
        }

        if (this.filteredProducts.length === 0) {
            productGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
          <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
          <h3 style="font-size: 20px; color: #111; margin-bottom: 8px;">No products found</h3>
          <p style="color: #666; margin-bottom: 24px;">Try adjusting your search or filters</p>
          <button onclick="productFilter.clearFilters()" class="btn btn-primary">Clear Filters</button>
        </div>
      `;
            return;
        }

        productGrid.innerHTML = this.filteredProducts.map(product => `
      <div class="product-card">
        ${this.renderProductCard(product)}
      </div>
    `).join('');
    }

    renderProductCard(product) {
        const imageUrl = product.images?.[0] ? `/images/products/${product.images[0]}` : null;

        return `
      <div style="width: 100%; height: 360px; background: linear-gradient(135deg, #ffffff 0%, #fafbfc 100%); overflow: hidden; display: flex; align-items: center; justify-content: center; border-radius: 0; cursor: pointer;" onclick="openProductModal('${product.id}', '${product.name}', '${product.price}', ${JSON.stringify(product.images || [])})">
        ${imageUrl ? `<img src="${imageUrl}" style="width: 95%; height: 95%; object-fit: contain; padding: 20px;" alt="${product.name}" />` : '<i class="fa-solid fa-image" style="font-size: 60px; color: #ccc;"></i>'}
      </div>

      <div style="padding: 16px 20px; overflow-x: auto; scrollbar-width: none; background: #f8f9fa; border-bottom: 1px solid #f0f0f0; display: ${product.images && product.images.length > 0 ? 'flex' : 'none'}; gap: 10px;">
        ${(product.images || []).map((img, idx) => `
          <img src="/images/products/${img}" style="width: 56px; height: 56px; object-fit: contain; border-radius: 10px; border: 2.5px solid #e8e8e8; cursor: pointer; flex-shrink: 0; padding: 4px; background: white;" alt="Thumbnail ${idx + 1}" />
        `).join('')}
      </div>

      <div style="padding: 20px 20px;">
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #111; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${product.name}</h3>
        <p style="font-size: 20px; font-weight: 800; color: #00bac6; margin-bottom: 16px; letter-spacing: -0.5px;">₹${parseFloat(product.price).toLocaleString('en-IN')}</p>
        <div style="display: flex; gap: 10px;">
          <button onclick="event.stopPropagation(); addToCart('${product.id}', '${product.name}', ${product.price}, '/images/products/${product.images?.[0] || ''}')" class="btn btn-primary" style="flex: 1; padding: 12px; font-size: 12px;">Add to Cart</button>
        </div>
      </div>
    `;
    }

    updateFilterSummary() {
        const summary = document.getElementById('filterSummary');
        if (!summary) return;

        const count = this.filteredProducts.length;
        const total = this.allProducts.length;

        let summaryText = `Showing ${count} of ${total} products`;

        if (this.filters.searchTerm) {
            summaryText += ` for "${this.filters.searchTerm}"`;
        }

        if (this.filters.minPrice > 0 || this.filters.maxPrice < Infinity) {
            summaryText += ` (₹${this.filters.minPrice} - ₹${this.filters.maxPrice})`;
        }

        summary.textContent = summaryText;
    }

    clearFilters() {
        // Reset all filters
        this.filters = {
            searchTerm: '',
            minPrice: 0,
            maxPrice: Infinity,
            sortBy: 'newest'
        };

        // Reset input values
        const searchInput = document.getElementById('filterSearchInput');
        if (searchInput) searchInput.value = '';

        const minPriceInput = document.getElementById('filterMinPrice');
        if (minPriceInput) minPriceInput.value = '0';

        const maxPriceInput = document.getElementById('filterMaxPrice');
        if (maxPriceInput) maxPriceInput.value = '';

        const sortSelect = document.getElementById('filterSort');
        if (sortSelect) sortSelect.value = 'newest';

        // Re-apply filters
        this.applyFilters();
        console.log('Filters cleared');
    }

    closeFilterPanel() {
        const filterPanel = document.getElementById('filterPanel');
        if (filterPanel) {
            filterPanel.classList.remove('open');
        }
    }

    openFilterPanel() {
        const filterPanel = document.getElementById('filterPanel');
        if (filterPanel) {
            filterPanel.classList.add('open');
        }
    }

    getMinAndMaxPrices() {
        if (this.allProducts.length === 0) return { min: 0, max: 10000 };

        const prices = this.allProducts.map(p => parseFloat(p.price));
        return {
            min: Math.min(...prices),
            max: Math.ceil(Math.max(...prices) / 100) * 100 // Round up to nearest 100
        };
    }
}

// Initialize filter when DOM is ready
let productFilter;
document.addEventListener('DOMContentLoaded', function () {
    productFilter = new ProductFilter();

    // Set price range defaults
    const priceRange = productFilter.getMinAndMaxPrices();
    const maxPriceInput = document.getElementById('filterMaxPrice');
    if (maxPriceInput && !maxPriceInput.value) {
        maxPriceInput.placeholder = `Up to ₹${priceRange.max}`;
        maxPriceInput.max = priceRange.max;
    }
});

// Helper function to show toast (if not already defined in main.js)
function showToast(message, type = 'success') {
    const container = document.getElementById('toasts');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}