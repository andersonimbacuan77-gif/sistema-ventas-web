let products = [];
let config = {};
let cart = [];

document.addEventListener('DOMContentLoaded', async () => {
    let searchQuery = '';
    const searchInput = document.getElementById('catalog-search');

    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase().trim();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                renderProducts();
            }, 300); // 300ms de calma para el procesador
        });
        // Evitar que el clic en el buscador propague eventos extraños en móviles
        searchInput.addEventListener('click', (e) => e.stopPropagation());
    }
    // 1. Session Check
    window.currentSession = await window.electronAPI.readData('session.json');
    if (!window.currentSession || !window.currentSession.currentUser) {
        window.location.href = 'login.html';
        return;
    }
    const session = window.currentSession;

    // CONTROL DE PERMISOS: Solo admins ven el botón de configuración
    const adminToggleBtn = document.getElementById('admin-toggle-btn');
    if (adminToggleBtn) {
        if (session.currentUser.role === 'admin') {
            adminToggleBtn.style.display = 'flex';
        } else {
            adminToggleBtn.style.display = 'none';
        }
    }

    // --- FASE 40: MOSTRAR USUARIO EN CABECERA ---
    const showLoggedUser = () => {
        const u = session.currentUser;
        const nameEl = document.getElementById('user-header-name');
        const avatarEl = document.getElementById('user-header-avatar');
        const roleEl = document.getElementById('user-header-role');
        
        if (u && nameEl && avatarEl) {
            const displayName = u.fullname || u.name || u.username;
            nameEl.textContent = displayName;
            avatarEl.textContent = String(displayName).charAt(0).toUpperCase();
            if (roleEl) roleEl.textContent = u.role === 'admin' ? 'Administrador' : 'Cliente / Usuario';
        }
    };
    showLoggedUser();
    // --- FIN FASE 40 ---

    // 2. Load Data
    const savedConfig = await window.electronAPI.readData('config.json');
    config = savedConfig || { categories: [], subcategories: [], company: {}, payments: [] };
    if (!config.company) config.company = {};
    if (!config.payments) config.payments = [];
    window.config = config; // GLOBALIZACIÓN PARA REPORTES
    
    const savedProducts = await window.electronAPI.readData('products.json');
    products = (savedProducts || []).map(p => {
        if (p.sizes && p.sizes.length > 0) {
            if (typeof p.sizes[0] === 'string') {
                p.sizes = p.sizes.map(s => ({ size: s.trim(), color: 'Único', stock: 0 }));
            } else if (p.sizes[0].color === undefined) {
                p.sizes = p.sizes.map(s => ({ ...s, color: 'Único' }));
            }
        }
        return p;
    });

    // 3. Inyectar Textos de Marca dinámicamente (FASE 65/69: PRIORIDAD NOMBRE DE EMPRESA)
    const comp = config.company || {};
    const appName = comp.name || comp.appName || 'CatalogApp'; // Cambiado a .name por petición del usuario
    const brandingCatalog = document.getElementById('dynamic-branding-catalog');
    
    if (brandingCatalog) {
        brandingCatalog.innerHTML = appName.split('').map((char, index) => 
            `<span style="--i:${index}">${char === ' ' ? '&nbsp;' : char}</span>`
        ).join('');
    }

    if(comp.heroTitle) {
        const h2Hero = document.querySelector('.hero h2');
        if(h2Hero) h2Hero.textContent = comp.heroTitle;
    }
    if(comp.heroSub) {
        const pHero = document.querySelector('.hero p');
        if(pHero) pHero.textContent = comp.heroSub;
    }

    // FASE 65: GENERAR ESTRELLAS Y REVELAR UI (Sin parpadeo)
    const initGalacticCatalog = () => {
        const starsContainer = document.getElementById('stars-container');
        if (starsContainer) {
            for (let i = 0; i < 200; i++) {
                const star = document.createElement('div');
                star.className = 'star';
                const size = Math.random() * 3 + 'px';
                star.style.width = size;
                star.style.height = size;
                star.style.left = Math.random() * 100 + '%';
                star.style.top = Math.random() * 100 + '%';
                star.style.animationDuration = (Math.random() * 50 + 50) + 's';
                star.style.animationDelay = (Math.random() * -100) + 's';
                starsContainer.appendChild(star);
            }
        }
        // Mostrar la App suavemente una vez que los textos reales están inyectados
        const appContainer = document.getElementById('app-container');
        if (appContainer) appContainer.classList.add('loaded');
    };
    initGalacticCatalog();

    // UI Elements
    const productGrid = document.getElementById('product-grid');
    const filterBar = document.getElementById('catalog-filter-bar');
    const cartCount = document.querySelector('.cart-count');
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const productModal = document.getElementById('product-modal');
    const productDetailContent = document.getElementById('product-detail-content');
    const customerNameInput = document.getElementById('customer-name');
    const confirmOrderBtn = document.getElementById('btn-confirm-order');
    const confirmedActions = document.getElementById('confirmed-actions');

    let confirmedSale = null;
    let receiptBase64 = null; // Ámbito superior corregido
    
    if (customerNameInput && session.currentUser.name) {
        customerNameInput.value = session.currentUser.name;
    }

    function resetConfirmation() {
        confirmedSale = null;
        if (confirmOrderBtn) {
            confirmOrderBtn.style.display = 'block';
            confirmOrderBtn.disabled = false;
            confirmOrderBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido';
        }
        if (confirmedActions) confirmedActions.style.display = 'none';
    }

    // Init UI se movió al final para evitar errores de referencia


    // Event Listeners - Header
    document.getElementById('btn-catalog-support')?.addEventListener('click', () => {
        const phone = config.company?.phone || '';
        if(!phone) return alert('No se ha configurado un número de soporte en los ajustes de la empresa.');
        
        // Limpiar caracteres no numéricos
        const cleanPhone = phone.replace(/\D/g, '');
        const msg = encodeURIComponent("¡Hola! Necesito soporte con mi compra en el catálogo.");
        window.open(`https://wa.me/${cleanPhone.startsWith('57') ? '' : '57'}${cleanPhone}?text=${msg}`, '_blank');
    });
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await window.electronAPI.writeData('session.json', { currentUser: null });
        window.location.href = 'login.html';
    });

    document.getElementById('admin-toggle-btn')?.addEventListener('click', () => {
        window.location.href = 'admin.html';
    });

    const cartToggle = document.getElementById('cart-toggle');
    const cartModal = document.getElementById('cart-modal');
    const closeCart = document.getElementById('close-cart');

    if (cartToggle && cartModal && closeCart) {
        cartToggle.addEventListener('click', () => {
            cartModal.classList.add('active');
            document.getElementById('app-container').classList.add('blur-background');
            renderPaymentMethods();
        });
        closeCart.addEventListener('click', () => {
            cartModal.classList.remove('active');
            document.getElementById('app-container').classList.remove('blur-background');
        });
    }

    // Modal Clicks
    if (productModal) {
        productModal.addEventListener('click', (e) => {
            if (e.target === productModal) {
                productModal.classList.remove('show');
                document.getElementById('app-container').classList.remove('blur-background');
            }
        });
    }

    document.getElementById('close-product-modal')?.addEventListener('click', () => {
        productModal.classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
    });

    // Functions
    // Variables de estado de filtrado
    let currentCategory = 'todos';
    let currentSubcategory = 'todas';

    function renderFilters() {
        if (!filterBar) return;
        const subBar = document.getElementById('subcategory-filter-bar');
        
        // Render Categorías Principales
        filterBar.innerHTML = `<button class="filter-btn ${currentCategory === 'todos' ? 'active' : ''}" data-category="todos">Todos</button>` + 
            config.categories.map(c => `<button class="filter-btn ${currentCategory === c.toLowerCase() ? 'active' : ''}" data-category="${c.toLowerCase()}">${c}</button>`).join('');
        
        const filterBtns = document.querySelectorAll('#catalog-filter-bar .filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentCategory = btn.dataset.category;
                currentSubcategory = 'todas'; // Reset subcat al cambiar categoría
                
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                renderSubfilters();
                renderProducts();
            });
        });

        renderSubfilters();
    }

    function renderSubfilters() {
        const subBar = document.getElementById('subcategory-filter-bar');
        if (!subBar) return;

        if (currentCategory === 'todos') {
            subBar.style.display = 'none';
            return;
        }

        // Filtrar subcategorías que pertenecen a la categoría actual
        // Asumiendo que config.subcategories es una lista de objetos { name, category }
        // O si es solo una lista de nombres, las mostramos todas si hay productos que las usen
        const relevantSubcats = [...new Set(products
            .filter(p => p.category.toLowerCase() === currentCategory)
            .map(p => p.subCategory)
            .filter(sc => sc)
        )];

        if (relevantSubcats.length === 0) {
            subBar.style.display = 'none';
            return;
        }

        subBar.style.display = 'flex';
        subBar.innerHTML = `<button class="filter-btn small ${currentSubcategory === 'todas' ? 'active' : ''}" data-sub="todas">Ver Todo ${currentCategory}</button>` + 
            relevantSubcats.map(sc => `<button class="filter-btn small ${currentSubcategory === sc.toLowerCase() ? 'active' : ''}" data-sub="${sc.toLowerCase()}">${sc}</button>`).join('');

        const subBtns = subBar.querySelectorAll('.filter-btn');
        subBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                currentSubcategory = btn.dataset.sub;
                subBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderProducts();
            });
        });
    }

    function renderProducts() {
        if (!productGrid) return;
        productGrid.innerHTML = '';
        const fragment = document.createDocumentFragment();
        
        let filtered = products;

        // Filtro Nivel 1: Categoría
        if (currentCategory !== 'todos') {
            filtered = filtered.filter(p => p.category.toLowerCase() === currentCategory);
        }

        // Filtro Nivel 2: Subcategoría
        if (currentSubcategory !== 'todas') {
            filtered = filtered.filter(p => p.subCategory && p.subCategory.toLowerCase() === currentSubcategory);
        }

        // Filtro Nivel 3: Búsqueda por Nombre o Referencia (Fase 46)
        if (searchQuery) {
            filtered = filtered.filter(p => 
                (p.name && p.name.toLowerCase().includes(searchQuery)) || 
                (p.id && String(p.id).toLowerCase().includes(searchQuery))
            );
        }

        filtered.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <div class="product-image" style="background-image: url('${p.image}')">
                    <div class="zoom-indicator" onclick="event.stopPropagation(); window.showLightbox('${p.image}')">
                        <i class="fas fa-search-plus"></i>
                    </div>
                </div>
                <div class="product-info">
                    <span class="category-badge">${p.category} ${p.subCategory ? ' / ' + p.subCategory : ''}</span>
                    <h3 class="product-title">${p.name}</h3>
                    <p class="product-price">$${(p.salePrice || 0).toLocaleString()}</p>
                    <button class="btn-premium-p" onclick="window.viewProductDetail('${p.id}')">
                        <i class="fas fa-eye"></i> Ver Detalles
                    </button>
                </div>
            `;
            fragment.appendChild(card);
        });
        productGrid.appendChild(fragment);
        
        // FASE 54: Asegurar prioridad absoluta de modales
        const modal = document.getElementById('product-modal');
        if(modal) modal.style.zIndex = "10000";
        const cModal = document.getElementById('cart-modal');
        if(cModal) cModal.style.zIndex = "10001";
    }

    window.viewProductDetail = (id) => {
        const p = products.find(x => String(x.id) === String(id));
        if (!p) return;

        let sizeOptions = '';
        if (p.sizes && p.sizes.length > 0) {
            sizeOptions = p.sizes.map((s, index) => {
                const stock = typeof s === 'object' ? s.stock : 0;
                const disabled = stock === 0 ? 'disabled' : '';
                const stockColor = stock > 5 ? '#22c55e' : (stock > 0 ? '#f59e0b' : '#ef4444');
                const stockText = stock > 0 ? `${stock} disp.` : 'Agotado';
                const stockLabel = `<span style="font-size:0.7rem; color:${stockColor}; position:absolute; top:-10px; right:-10px; background:var(--glass-bg); padding:2px 8px; border-radius:12px; box-shadow:var(--shadow-sm); border:1px solid var(--glass-border); font-weight:700; backdrop-filter:blur(10px);">${stockText}</span>`;
                
                return `
                    <button class="variant-btn ${disabled}" data-size="${s.size}" data-color="${s.color || ''}" style="position:relative; outline: none; padding:12px 18px; border:1px solid var(--glass-border); border-radius:var(--radius-lg); background:var(--glass-bg); cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:5px; transition:var(--transition); min-width:90px;">
                        ${stockLabel}
                        <span style="font-weight:800; font-size:1.2rem; color:var(--text-main);">${s.size}</span>
                        <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:8px; width:100%; text-align:center; text-transform: capitalize;">${s.color || 'Único'}</span>
                    </button>
                `;
            }).join('');
        } else {
            sizeOptions = '<p style="color:var(--text-muted); font-size:0.9rem;">Talla Única / Sin Variantes</p>';
        }

        let galleryHtml = '';
        if (p.images && p.images.length > 1) {
            const safeImages = p.images.map(img => typeof img === 'string' ? {url: img, color: ''} : img);
            galleryHtml = `
            <div style="display:flex; gap:10px; margin-top:15px; overflow-x:auto; padding-bottom:10px;">
                ${safeImages.map(imgObj => `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex-shrink:0;">
                        <div onclick="document.getElementById('main-p-image').src='${imgObj.url}'" style="width:65px; height:65px; border-radius:12px; cursor:pointer; background-image:url('${imgObj.url}'); background-size:cover; background-position:center; border: 2.5px solid var(--glass-border); transition: border-color 0.2s;" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--glass-border)'"></div>
                        <span style="font-size:0.65rem; font-weight:700; color:var(--text-main); background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:8px; max-width:65px; text-align:center; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; min-height:1.2em;" title="${imgObj.color || 'Color'}">${imgObj.color || '-'}</span>
                    </div>
                `).join('')}
            </div>
            `;
        }

        productDetailContent.innerHTML = `
            <div style="display: flex; gap: 30px; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px; position: relative;">
                    <!-- Icono de Zoom (Fase 48) -->
                    <div style="position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: zoom-in; opacity: 0.8; transition: 0.3s; border: 1px solid rgba(255,255,255,0.2); pointer-events: none;" id="p-image-zoom-indicator">
                        <i class="fas fa-search-plus"></i>
                    </div>
                    <img id="main-p-image" src="${p.image}" onclick="openLightbox(this.src)" style="width: 100%; border-radius: 12px; box-shadow: var(--shadow); object-fit: cover; aspect-ratio: 1/1; transition: src 0.3s ease-in-out; cursor: zoom-in;" title="Haz clic para ver en pantalla completa">
                    ${galleryHtml}
                </div>
                <div style="flex: 1.5; min-width: 300px; display: flex; flex-direction: column; gap: 15px;">
                    <span class="category-badge" style="align-self: flex-start;">${p.category} / ${p.subCategory}</span>
                    <h2 style="font-size: 2rem; color: var(--text);">${p.name}</h2>
                    <p style="color: var(--text-muted); font-size: 0.9rem;">REF: ${p.ref || 'SIN-REF'}</p>
                    <p style="font-size: 1.8rem; color: var(--primary); font-weight: bold;">$${(p.salePrice || 0).toLocaleString()}</p>
                    <p style="color: var(--text-muted); line-height: 1.6;">${p.description}</p>
                    
                    <div class="size-selector" style="margin-top: 10px;">
                        <span style="display: block; margin-bottom: 10px; font-weight: 600;">Selecciona una Variante:</span>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;" id="size-options-container">
                            ${sizeOptions}
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 15px; margin-top: auto; align-items: flex-end;">
                        <div style="display: flex; flex-direction: column;">
                            <label style="font-size: 0.8rem; font-weight: 600; color: #64748b; margin-bottom: 5px;">Cantidad:</label>
                            <div style="display: flex; align-items: center; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 5px;">
                                <button type="button" onclick="const input = document.getElementById('add-qty-input'); input.value = Math.max(1, parseInt(input.value) - 1);" style="width: 35px; height: 35px; border-radius: 10px; border: none; background: rgba(255,255,255,0.1); color: var(--text-main); cursor: pointer; font-weight: 700;">-</button>
                                <input type="text" id="add-qty-input" value="1" min="1" readonly style="width: 50px; text-align: center; border: none; background: transparent; font-size: 1.1rem; color: var(--text-main); font-weight: 800; display: flex; align-items: center; justify-content: center;">
                                <button type="button" onclick="const input = document.getElementById('add-qty-input'); input.value = parseInt(input.value) + 1;" style="width: 35px; height: 35px; border-radius: 10px; border: none; background: rgba(255,255,255,0.1); color: var(--text-main); cursor: pointer; font-weight: 700;">+</button>
                            </div>
                        </div>
                        <button class="btn-premium-p" id="add-to-cart-btn" style="padding: 15px; font-size: 1.1rem; flex: 1;">
                            <i class="fas fa-cart-plus"></i> Agregar al Carrito
                        </button>
                    </div>
                </div>
            </div>
        `;

        productModal.classList.add('show');
        document.getElementById('app-container').classList.add('blur-background');

        let selectedSize = null;
        let selectedColor = null;
        const variantBtns = productDetailContent.querySelectorAll('.variant-btn:not(.disabled)');
        variantBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                variantBtns.forEach(b => {
                    b.style.borderColor = 'var(--glass-border)';
                    b.style.boxShadow = 'none';
                    b.style.background = 'var(--glass-bg)';
                });
                btn.style.borderColor = 'var(--primary)';
                btn.style.boxShadow = 'var(--shadow-primary)';
                btn.style.background = 'rgba(168, 85, 247, 0.15)';
                selectedSize = btn.dataset.size;
                selectedColor = btn.dataset.color;
            });
        });

        const addToCartMainBtn = document.getElementById('add-to-cart-btn');
        // Eliminar listeners previos para evitar duplicidad
        const newAddToCartBtn = addToCartMainBtn.cloneNode(true);
        addToCartMainBtn.parentNode.replaceChild(newAddToCartBtn, addToCartMainBtn);

        newAddToCartBtn.addEventListener('click', async () => {
            if (p.sizes && p.sizes.length > 0 && (!selectedSize || !selectedColor)) {
                return alert('Por favor selecciona una variante (Talla/Color).');
            }
            const qtyStr = document.getElementById('add-qty-input').value;
            const qty = parseInt(qtyStr) || 1;
            
            const selVariant = p.sizes ? p.sizes.find(s => s.size === selectedSize && s.color === selectedColor) : null;
            if (selVariant && selVariant.stock < qty) {
                return alert(`Solo hay ${selVariant.stock} unidades disponibles de esta variante.`);
            }

            // FASE 57: RESERVA EN MEMORIA (INSTANTÁNEO)
            updateLocalStock(p.id, selectedSize, selectedColor, -qty);
            
            addToCart({...p, selectedSize, selectedColor, qty});
            productModal.classList.remove('show');
            document.getElementById('app-container').classList.remove('blur-background');
        });
    };

    // FASE 57: ACTUALIZACIÓN LOCAL (SIN ESCRITURA A DISCO HASTA EL FINAL)
    function updateLocalStock(productId, variantSize, variantColor, delta) {
        const pIndex = products.findIndex(p => p.id === productId);
        if (pIndex !== -1 && products[pIndex].sizes) {
            products[pIndex].sizes = products[pIndex].sizes.map(s => {
                if (typeof s === 'object' && s.size === variantSize && s.color === variantColor) {
                    return { ...s, stock: Math.max(0, s.stock + delta) };
                }
                return s;
            });
            renderProducts();
        }
    }

    function addToCart(product) {
        const existing = cart.find(i => i.id === product.id && i.selectedSize === product.selectedSize && i.selectedColor === product.selectedColor);
        if (existing) {
            existing.qty = (existing.qty || 1) + (product.qty || 1);
        } else {
            product.qty = product.qty || 1;
            cart.push(product);
        }
        resetConfirmation();
        updateCart();
        
        // FASE 7: NOTIFICACIÓN EN LUGAR DE ABRIR MODAL
        showToast(`<i class="fas fa-check-circle" style="color:#10b981;"></i> Artículo añadido al carrito`);
    }

    function showToast(message) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.style.background = 'rgba(15, 23, 42, 0.9)';
        toast.style.backdropFilter = 'blur(10px)';
        toast.style.color = 'white';
        toast.style.padding = '12px 25px';
        toast.style.borderRadius = '50px';
        toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5), 0 0 15px var(--primary-glow)';
        toast.style.border = '1px solid var(--glass-border)';
        toast.style.fontSize = '0.95rem';
        toast.style.fontWeight = '700';
        toast.style.display = 'flex';
        toast.style.alignItems = 'center';
        toast.style.gap = '10px';
        toast.style.animation = 'toastIn 0.5s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards';
        toast.innerHTML = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toastOut 0.5s forwards';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    function updateCart() {
        if (!cartCount || !cartItems) return;
        const totalItemsCount = cart.reduce((sum, item) => sum + (item.qty || 1), 0);
        cartCount.textContent = totalItemsCount;
        cartItems.innerHTML = '';
        let total = 0;
        cart.forEach((item, index) => {
            const itemQty = item.qty || 1;
            const lineTotal = (item.salePrice || 0) * itemQty;
            total += lineTotal;
            
            const el = document.createElement('div');
            el.className = 'cart-item';
            el.style.padding = '15px';
            el.style.marginBottom = '12px';
            el.style.background = 'rgba(255,255,255,0.03)';
            el.style.borderRadius = '15px';
            el.style.border = '1px solid var(--glass-border)';
            el.style.transition = '0.3s';

            el.innerHTML = `
                <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; gap:10px;">
                    <div style="flex: 1;">
                        <strong style="display:block; font-size: 1.1rem; color: #fff; margin-bottom:4px;">${item.name}</strong> 
                        <div style="color: #94a3b8; font-size: 0.85rem; line-height:1.4;">
                            <span style="display:inline-block; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; margin-right:5px;">REF: ${item.ref || 'S/R'}</span>
                            <span style="display:inline-block; background:rgba(99, 102, 241, 0.1); color:#818cf8; padding:2px 6px; border-radius:4px;">Talla: ${item.selectedSize || 'N/A'}</span>
                            <span style="display:inline-block; background:rgba(168, 85, 247, 0.1); color:#a78bfa; padding:2px 6px; border-radius:4px;">Color: ${item.selectedColor || 'N/A'}</span>
                        </div>
                    </div>
                    <div style="text-align: right; min-width: 100px;">
                        <div style="font-weight: 800; color: var(--primary); font-size: 1.1rem;">$${lineTotal.toLocaleString()}</div>
                        <small style="color: #64748b; font-size: 0.75rem;">($${(item.salePrice || 0).toLocaleString()} c/u)</small>
                    </div>
                </div>
                <div style="width: 100%; display: flex; align-items: center; margin-top: 15px; gap: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top:12px;">
                    <div style="display: flex; align-items: center; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 5px; border: 1px solid var(--glass-border);">
                        <button onclick="window.changeCartQty(${index}, -1)" style="width: 32px; height: 32px; border: none; background: rgba(255,255,255,0.05); color: #fff; border-radius: 10px; cursor: pointer; font-weight: 900; font-size:1.1rem; display:flex; align-items:center; justify-content:center;">-</button>
                        <span style="padding: 0 15px; font-weight: 800; font-size: 1.1rem; color: #fff;">${itemQty}</span>
                        <button onclick="window.changeCartQty(${index}, 1)" style="width: 32px; height: 32px; border: none; background: var(--primary); color: #fff; border-radius: 10px; cursor: pointer; font-weight: 900; font-size:1.1rem; display:flex; align-items:center; justify-content:center;">+</button>
                    </div>
                    <button class="btn-icon" onclick="window.removeFromCart(${index})" style="margin-left: auto; color: #f43f5e; font-size: 1.1rem; background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 10px; padding: 8px 12px; cursor:pointer; transition:0.3s;" title="Eliminar del carrito"><i class="fas fa-trash-alt"></i></button>
                </div>
            `;
            cartItems.appendChild(el);
        });
        cartTotal.innerHTML = `<span style="font-size: 1rem; color: #94a3b8; font-weight:400; margin-right:10px;">Total a Pagar:</span> $${total.toLocaleString()}`;
        cartTotal.style.fontSize = '1.8rem';
        cartTotal.style.fontWeight = '800';
        cartTotal.style.color = 'var(--primary)';
        cartTotal.style.textShadow = '0 0 20px rgba(59, 130, 246, 0.3)';
    }

    let selectedPaymentMethod = null;
    function renderPaymentMethods() {
        const container = document.getElementById('payment-methods-selector');
        if(!container) return;
        
        if(!config.payments || config.payments.length === 0) {
            container.innerHTML = '<p style="grid-column: span 2; font-size: 0.7rem; color: #ef4444;">No hay métodos de pago configurados.</p>';
            return;
        }

        container.innerHTML = config.payments.map((p, i) => `
            <button class="payment-btn" onclick="selectPayment(${i})" style="padding: 8px; border-radius: 10px; border: 1px solid var(--glass-border); background: rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.75rem; cursor: pointer; font-weight: 600; text-align: center; transition: 0.2s;">
                ${p.name}
            </button>
        `).join('');
    }

    window.selectPayment = (index) => {
        const p = config.payments[index];
        selectedPaymentMethod = p;
        
        // UI Feedback
        const btns = document.querySelectorAll('.payment-btn');
        btns.forEach((b, i) => {
            b.style.background = (i === index) ? 'var(--primary-glow)' : 'rgba(255,255,255,0.02)';
            b.style.borderColor = (i === index) ? 'var(--primary)' : 'var(--glass-border)';
            b.style.color = (i === index) ? 'white' : 'var(--text-main)';
        });

        const qrContainer = document.getElementById('qr-display-container');
        const qrImg = document.getElementById('qr-payment-img');
        if(p.qr) {
            qrImg.src = p.qr;
            qrContainer.style.display = 'block';
        } else {
            qrContainer.style.display = 'none';
        }
    };

    window.changeCartQty = async (index, delta) => {
        const item = cart[index];
        if (!item) return;

        // FASE 41: Validar stock antes de aumentar
        if (delta > 0) {
            // Se lee el stock actual de la lista local 'products'
            const p = products.find(x => x.id === item.id);
            const variant = p?.sizes?.find(s => s.size === item.selectedSize && s.color === item.selectedColor);
            if (!variant || variant.stock < delta) {
                return alert('No hay más existencias disponibles para aumentar la cantidad.');
            }
        }

        // FASE 57: Ajuste en memoria
        updateLocalStock(item.id, item.selectedSize, item.selectedColor, -delta);

        item.qty = Math.max(1, (item.qty || 1) + delta);
        resetConfirmation();
        updateCart();
    };

    window.removeFromCart = async (index) => {
        const item = cart[index];
        if (item) {
            // FASE 57: Devolución en memoria
            updateLocalStock(item.id, item.selectedSize, item.selectedColor, item.qty);
        }
        cart.splice(index, 1);
        resetConfirmation();
        updateCart();
    };

    function generateInvoiceFile(cartItems, totalVal, customerName = 'Consumidor Final') {
        const company = config.company || {};
        const header = company.name ? `🏢 ${company.name.toUpperCase()}\nNIT: ${company.nit || ''}\n📍 ${company.address || ''}\n📞 ${company.phone || ''}\n` : 'FACTURA DE VENTA';
        let invoiceText = `================================\n${header}\n================================\nFecha: ${new Date().toLocaleString('es-CO', { hour12: true })}\nCliente: ${customerName}\n\n`;
        cartItems.forEach(item => {
            const qty = item.qty || 1;
            const unitPrice = item.salePrice || 0;
            const subtotal = unitPrice * qty;
            invoiceText += `[x${qty}] ${item.name}\nRef: ${item.ref || 'S/R'} | Talla: ${item.selectedSize || 'N/A'} | Color: ${item.selectedColor || 'N/A'}\nVALOR UNITARIO: $${unitPrice.toLocaleString()}\nSUBTOTAL: $${subtotal.toLocaleString()}\n--------------------------------\n`;
        });
        invoiceText += `\nTOTAL A PAGAR: $${totalVal.toLocaleString()}\n================================\n   ¡Gracias por su compra!      \n`;
        
        const blob = new Blob([invoiceText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.setAttribute('download', `factura_${Date.now()}.txt`);
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    window.printTicketDirectly = (saleData) => {
        if(!saleData || !saleData.items) return;
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow.document;
        const itemsHtml = saleData.items.map(item => {
            const qty = item.qty || 1;
            const unitPrice = item.salePrice || 0;
            const subtotal = unitPrice * qty;
            return `
            <div style="border-bottom: 1px dashed #ccc; padding: 5px 0;">
                <div style="display:flex; justify-content:space-between;">
                    <b>${item.name}</b>
                </div>
                <div style="font-size:0.8rem; color:#666;">Ref: ${item.ref || 'S/R'} | Talla: ${item.selectedSize || 'N/A'} | Color: ${item.selectedColor || 'N/A'}</div>
                <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-top:3px; background:#f0f0f0; padding:2px 4px;">
                    <span>PRECIO UNIT: <b>$${unitPrice.toLocaleString()}</b> x ${qty}</span>
                    <b>$${subtotal.toLocaleString()}</b>
                </div>
            </div>
        `}).join('');

        const company = config.company || {};
        const companyHtml = company.name ? `
            <div style="margin-bottom:10px; border-bottom:1px solid #000; padding-bottom:5px;">
                <h3 style="margin:0; font-size:16px;">${company.name.toUpperCase()}</h3>
                <div style="font-size:11px;">NIT: ${company.nit || ''}</div>
                <div style="font-size:10px;">${company.address || ''}</div>
                <div style="font-size:10px;">Tel: ${company.phone || ''}</div>
            </div>
        ` : '';

        doc.write(`
            <html>
            <head>
                <style>
                    @page { margin: 0; }
                    body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0; padding: 10px; font-size: 11px; color: #000; }
                    .header { text-align: center; margin-bottom: 15px; }
                    .footer { text-align: center; margin-top: 25px; border-top: 1px dashed #000; padding-top: 10px; font-size: 10px; }
                    .total { font-size: 1.2rem; font-weight: bold; margin-top: 20px; text-align: right; border-top: 2px solid #000; padding-top: 5px; }
                </style>
            </head>
            <body onload="window.print();">
                <div class="header">
                    ${companyHtml}
                    <h2 style="margin:5px 0; font-size: 14px;">ORDEN DE COMPRA</h2>
                    <div style="font-size: 12px; font-weight: bold;">Ticket #${saleData.id || 'NUEVO'}</div>
                </div>
                <div class="info">
                    <div style="margin-bottom: 5px;"><b>Fecha:</b> ${new Date().toLocaleString('es-CO', { hour12: true })}</div>
                    <div style="border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px;">
                        <div><b>Cliente:</b> ${saleData.customerName || 'Consumidor Final'}</div>
                        <div><b>NIT/CC:</b> ${saleData.nit || 'N/A'}</div>
                        <div><b>Teléfono:</b> ${saleData.phone || 'N/A'}</div>
                        <div><b>Dirección:</b> ${saleData.address || 'N/A'}</div>
                        <div><b>Ubicación:</b> ${saleData.city || 'N/A'}, ${saleData.department || 'N/A'}</div>
                        <div><b>Pago:</b> ${saleData.paymentMethod || 'N/A'}</div>
                    </div>
                </div>
                <div style="border-top: 1px solid #000; padding-top: 10px; margin-top: 10px;">
                    ${itemsHtml}
                </div>
                <div class="total">TOTAL: $${saleData.total.toLocaleString()}</div>
                <div class="footer">¡Gracias por preferirnos!</div>
            </body>
            </html>
        `);
        doc.close();
        setTimeout(() => { document.body.removeChild(iframe); }, 3000);
    };

    confirmOrderBtn?.addEventListener('click', async () => {
        if (cart.length === 0) return alert('Carrito vacío');
        const customerName = customerNameInput.value.trim();
        if (!customerName) return alert('Por favor, ingresa tu nombre para procesar el pedido.');

        const total = cart.reduce((sum, item) => sum + ((item.salePrice || 0) * (item.qty || 1)), 0);

        try {
            // FASE 58: Feedback de carga inmediato
            confirmOrderBtn.disabled = true;
            confirmOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';

            // FASE 58: La variable 'products' YA ESTÁ actualizada en memoria (por updateLocalStock)
            // Solo necesitamos persistirla al final de manera asíncrona (fuego y olvido relativo)
            window.electronAPI.writeData('products.json', products).catch(e => console.error("Error persistiendo stock:", e));

            const u = session.currentUser || {};
            confirmedSale = {
                id: Date.now(),
                date: new Date().toISOString(),
                customerName: customerName,
                nit: u.nit || 'N/A',
                phone: u.phone || 'N/A',
                address: u.address || 'N/A',
                items: [...cart],
                total: total,
                paymentMethod: selectedPaymentMethod ? selectedPaymentMethod.name : 'No especificado',
                receipt: receiptBase64 
            };

            // OPTIMIZACIÓN CRÍTICA (antes tardaba 20-40 seg):
            // Antes: readData('sales.json') [~15 seg] + writeData(todo_el_array) [~15 seg]
            // Ahora: un solo POST con solo la nueva venta = el servidor hace Model.create() directo
            await window.electronAPI.writeData('sales.json', confirmedSale);

            confirmOrderBtn.style.display = 'none';
            confirmedActions.style.display = 'block';
            renderProducts();
            
            // Sonido o alerta sutil
            alert('¡PEDIDO CONFIRMADO! 🚀⚡');
        } catch (error) {
            console.error('Error:', error);
            confirmOrderBtn.disabled = false;
            confirmOrderBtn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar Pedido';
            alert('Error al confirmar. Intenta de nuevo.');
        }
    });

    document.getElementById('receipt-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            receiptBase64 = event.target.result;
            const container = document.getElementById('receipt-preview-container');
            const preview = document.getElementById('receipt-preview-img');
            const label = document.getElementById('receipt-label');
            
            preview.src = receiptBase64;
            container.style.display = 'block';
            label.style.background = 'rgba(16, 185, 129, 0.2)';
            label.innerHTML = '<i class="fas fa-sync"></i> CAMBIAR RECIBO';
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('send-order')?.addEventListener('click', () => {
        if (!confirmedSale) return alert('Primero debes confirmar el pedido');
        const { customerName, total, items } = confirmedSale;
        const company = config.company || {};
        const companyLabel = company.name ? `🏢 *${company.name.toUpperCase()}*\nNIT: ${company.nit || 'N/A'}\n📍 ${company.address || ''}\n📞 ${company.phone || ''}\n` : '';
        
        // EVALUACIÓN EN TIEMPO REAL: Si hay receiptBase64, está pagado
        const isPaid = !!receiptBase64;
        const statusText = isPaid ? '✅ *ESTADO: PAGADO*' : '⚠️ *ESTADO: PENDIENTE DE PAGO*';
        const receiptNote = isPaid ? '\n📎 *RECIBO ADJUNTO (ENVIAR A CONTINUACIÓN)*' : '';

        const u = session.currentUser || {};
        const dateStr = new Date().toLocaleString('es-CO', { hour12: true });
        
        let msg = `━━━━━━━━━━━━━━━━━━\n`;
        msg += `📄 *FACTURA DE PEDIDO*\n`;
        msg += `━━━━━━━━━━━━━━━━━━\n\n`;
        
        msg += `${companyLabel}\n`;
        msg += `──────────────────\n`;
        msg += `📅 *Fecha:* ${dateStr}\n`;
        msg += `👤 *Cliente:* ${u.name || customerName}\n`;
        msg += `🆔 *NIT/CC:* ${u.nit || 'N/A'}\n`;
        msg += `📍 *Ciudad:* ${u.city || 'N/A'}, ${u.department || 'N/A'}\n`;
        msg += `🏠 *Dirección:* ${u.address || 'N/A'}\n`;
        msg += `📞 *Teléfono:* ${u.phone || 'N/A'}\n`;

        if(selectedPaymentMethod) {
            msg += `💳 *Método de Pago:* ${selectedPaymentMethod.name}\n`;
        }
        
        msg += `\n📦 *DETALLE DE PRODUCTOS:*\n`;
        msg += `──────────────────\n`;

        items.forEach(item => { 
            const qty = item.qty || 1;
            const unitPrice = item.salePrice || 0;
            const subtotal = unitPrice * qty;
            const variant = (item.selectedSize || item.selectedColor) ? ` (${item.selectedSize || ''} ${item.selectedColor || ''})` : '';
            
            msg += `🔹 *${item.name}${variant}*\n`;
            msg += `   $${unitPrice.toLocaleString()}  x  ${qty}  =  *$${subtotal.toLocaleString()}*\n\n`;
        });
        
        msg += `──────────────────\n`;
        msg += `💰 *TOTAL GENERAL: $${total.toLocaleString()}*\n`;
        msg += `──────────────────\n`;
        msg += `\n${statusText}${receiptNote}\n`;
        msg += `\n🙏 *¡Gracias por su compra!*`;
        
        window.open(`https://wa.me/573105742784?text=${encodeURIComponent(msg)}`, '_blank');
        alert('Pedido enviado a WhatsApp. Recuerda adjuntar la imagen del recibo si la subiste.');
    });

    const resetFullCart = async () => {
        // FASE 41: Devolver todo el stock reservado si no se confirmó la venta final
        // Si confirmedSale existe, no devolvemos (porque la venta es real)
        if (!confirmedSale && cart.length > 0) {
            for (const item of cart) {
                updateLocalStock(item.id, item.selectedSize, item.selectedColor, item.qty);
            }
        }
        // FASE 59: MANTENER NOMBRE DEL USUARIO LOGUEADO
        const u = window.currentSession?.currentUser || {};
        const oldName = u.name || u.fullname || u.username || '';
        if(customerNameInput) customerNameInput.value = oldName;

        cart = [];
        selectedPaymentMethod = null;
        receiptBase64 = null;
        updateCart();
        resetConfirmation();
        
        // Reset UI
        document.getElementById('qr-display-container').style.display = 'none';
        document.getElementById('receipt-preview-container').style.display = 'none';
        const label = document.getElementById('receipt-label');
        if(label) {
            label.style.background = 'rgba(16, 185, 129, 0.1)';
            label.innerHTML = '<i class="fas fa-file-upload"></i> SUBIR RECIBO';
        }

        document.getElementById('cart-modal').classList.remove('active');
        document.getElementById('app-container').classList.remove('blur-background');
    };

    document.getElementById('btn-new-sale-anytime')?.addEventListener('click', resetFullCart);
    document.getElementById('btn-new-sale')?.addEventListener('click', resetFullCart);
    
    document.getElementById('print-invoice')?.addEventListener('click', () => {
        if (!confirmedSale) return alert('Primero debes confirmar el pedido');
        const { customerName, total, items } = confirmedSale;
        generateInvoiceFile(items, total, customerName);
    });

    document.getElementById('btn-print-direct-catalog')?.addEventListener('click', () => {
        if (!confirmedSale) return alert('Primero debes confirmar el pedido');
        window.printTicketDirectly(confirmedSale);
    });
    // FINAL INIT: Ejecutar después de que todas las funciones estén definidas
    renderFilters();
    renderProducts();
});

window.openLightbox = (src) => {
    const lightbox = document.getElementById('image-lightbox');
    const img = document.getElementById('lightbox-img');
    if(lightbox && img) {
        img.src = src;
        lightbox.style.display = 'flex';
        lightbox.style.zIndex = '100000'; // Prioridad masiva rectificada
    }
};
