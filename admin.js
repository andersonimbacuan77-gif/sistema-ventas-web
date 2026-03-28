let products = [];
let config = {};
let currentProductImagesBase64 = [];

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Verificación de Sesión
    const session = await window.electronAPI.readData('session.json');
    if (!session || !session.currentUser) {
        window.location.href = 'login.html';
        return;
    }

    // PROTECCIÓN DE ACCESO: Solo administradores entran al Panel Admin completo
    if (session.currentUser.role !== 'admin') {
        alert('Acceso Denegado: No tienes permisos de administrador.');
        window.location.href = 'catalog.html';
        return;
    }

    // 2. Carga de Datos y Migración Fase 6/8
    // FASE 74 FIX: Leer config desde la API del servidor (MongoDB) para que branding y temas sean correctos
    let savedConfig = null;
    try {
        const r = await fetch('/api/data/config.json?v=' + Date.now());
        savedConfig = await r.json();
    } catch(e) {
        // Fallback a Electron si la API no está disponible
        try {
            if (window.electronAPI && window.electronAPI.readData) {
                savedConfig = await window.electronAPI.readData('config.json');
            }
        } catch(e2) {}
    }
    config = savedConfig || { categories: [], subcategories: [], company: {}, payments: [] };
    if (!config.company) config.company = {};
    if (!config.payments) config.payments = [];
    window.config = config; // GLOBALIZACIÓN CRÍTICA PARA REPORTES
    
    const savedProducts = await window.electronAPI.readData('products.json');
    products = savedProducts || [];

    // Migración Automática (Fase 6 y Fase 7): Añadir soporte de color nulo nativo
    let needsMigration = false;
    products = products.map(p => {
        if (p.sizes && p.sizes.length > 0) {
            if (typeof p.sizes[0] === 'string') {
                needsMigration = true;
                p.sizes = p.sizes.map(s => ({ size: s.trim(), color: 'Único', stock: 0 }));
            } else if (p.sizes[0].color === undefined) {
                needsMigration = true;
                p.sizes = p.sizes.map(s => ({ ...s, color: 'Único' }));
            }
        }
        return p;
    });
    if (needsMigration) await window.electronAPI.writeData('products.json', products);

    // Función para mostrar usuario en cabecera (Fase 40)
    const showLoggedUser = () => {
        const u = session.currentUser;
        const nameEl = document.getElementById('user-header-name');
        const avatarEl = document.getElementById('user-header-avatar');
        const roleEl = document.getElementById('user-header-role');
        
        if (u && nameEl && avatarEl) {
            const displayName = u.fullname || u.name || u.username;
            nameEl.textContent = displayName;
            avatarEl.textContent = String(displayName).charAt(0).toUpperCase();
            if (roleEl) roleEl.textContent = u.role === 'admin' ? 'Administrador Maestro' : 'Acceso Admin';
        }
    };
    showLoggedUser();

    // FASE 68/69: BRANDING DINÁMICO AZUL-VERDE (PRIORIDAD NOMBRE DE EMPRESA)
    const refreshBranding = () => {
        const brandingEl = document.getElementById('dynamic-branding-admin');
        if (brandingEl) {
            const appName = config.company?.name || config.company?.appName || 'CatalogApp';
            brandingEl.innerHTML = appName.split('').map((char, index) => 
                `<span style="--i:${index}">${char === ' ' ? '&nbsp;' : char}</span>`
            ).join('') + ' Admin';
        }
    };
    refreshBranding();

    // FASE 60: CARGA INICIAL MÍNIMA (Solo lo necesario para ver la primera pantalla)
    refreshDynamicUI();
    renderAdminProducts();
    renderCategorySettings();
    // loadSales, loadReports y renderUsers se movieron a carga bajo demanda (Lazy Loading)

    // Listeners del Header
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await window.electronAPI.writeData('session.json', { currentUser: null });
        window.location.href = 'login.html';
    });
    document.getElementById('catalog-return-btn').addEventListener('click', () => {
        window.location.href = 'catalog.html';
    });

    // Listeners Pestañas Admin
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const adminInventoryTab = document.getElementById('admin-inventory-tab');
    const adminCategoriesTab = document.getElementById('admin-categories-tab');
    const adminSalesTab = document.getElementById('admin-sales-tab');
    const adminReportsTab = document.getElementById('admin-reports-tab');
    const adminSettingsTab = document.getElementById('admin-settings-tab');
    const adminAuditTab = document.getElementById('admin-audit-tab');
    const adminUsersTab = document.getElementById('admin-users-tab');

    // FASE 60: ESTADO DE CARGA DE PESTAÑAS
    const loadedTabs = {
        inventory: true,
        categories: true,
        sales: false,
        reports: false,
        settings: false,
        audit: false,
        users: false
    };

    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Respuesta visual instantánea
            adminTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.tab;
            
            [adminInventoryTab, adminCategoriesTab, adminSalesTab, adminReportsTab, adminSettingsTab, adminAuditTab, adminUsersTab].forEach(t => {
                if(t) t.classList.remove('active');
            });

            // Carga diferida inteligente
            if (tab === 'inventory') {
                adminInventoryTab.classList.add('active');
                renderAdminProducts();
            } else if (tab === 'categories') {
                adminCategoriesTab.classList.add('active');
                renderCategorySettings();
            } else if (tab === 'sales') {
                adminSalesTab.classList.add('active');
                if (!loadedTabs.sales) {
                    await loadSales();
                    loadedTabs.sales = true;
                }
                renderSales();
            } else if (tab === 'reports') {
                if (adminReportsTab) adminReportsTab.classList.add('active');
                if (!loadedTabs.reports) {
                    await loadReports();
                    loadedTabs.reports = true;
                }
                renderReports();
            } else if (tab === 'settings') {
                if (adminSettingsTab) adminSettingsTab.classList.add('active');
                renderSystemSettings();
                if (!loadedTabs.settings) {
                    await renderUsers();
                    loadedTabs.settings = true;
                }
            } else if (tab === 'audit') {
                if (adminAuditTab) adminAuditTab.classList.add('active');
                renderStockAuditTree();
            } else if (tab === 'users') {
                if (adminUsersTab) adminUsersTab.classList.add('active');
                if (!loadedTabs.users) {
                    await renderUsers();
                    loadedTabs.users = true;
                }
                renderUsers();
            }
        });
    });

    // FASE 72: GLOBALIZACIÓN DE SAVECONFIG - FIX: Refrescar UI inmediatamente
    window.saveConfig = async () => {
        await window.electronAPI.writeData('config.json', config);
        // Refrescar UI de categorias y selectores inmediatamente sin esperar recarga
        renderCategorySettings();
        refreshDynamicUI();
        if(typeof refreshBranding === 'function') refreshBranding();
    };

    const saveConfig = window.saveConfig;

    // ---- Lógica de Categorías ----
    document.getElementById('add-category-btn').addEventListener('click', () => {
        const input = document.getElementById('new-category-name');
        if (input.value.trim()) {
            config.categories.push(input.value.trim());
            input.value = '';
            saveConfig();
        }
    });

    document.getElementById('add-subcategory-btn').addEventListener('click', () => {
        const input = document.getElementById('new-subcategory-name');
        const parentSelect = document.getElementById('new-subcategory-parent');
        if (input.value.trim() && parentSelect.value) {
            config.subcategories.push({
                name: input.value.trim(),
                parent: parentSelect.value
            });
            input.value = '';
            saveConfig();
        }
    });

    window.removeConfigItem = (type, index) => {
        const item = config[type][index];
        const name = (type === 'categories') ? item : item.name;
        const itemName = name.toLowerCase();

        // VALIDACIÓN DE USO: No permitir borrar si hay productos usándola
        const isUsed = products.some(p => {
            if (type === 'categories') return p.category.toLowerCase() === itemName;
            return p.subCategory.toLowerCase() === itemName;
        });

        if (isUsed) {
            alert(`🚫 PROTECCIÓN DE DATOS: No se puede eliminar la ${type === 'categories' ? 'categoría' : 'subcategoría'} "${name}" porque está vinculada a uno o más productos existentes.`);
            return;
        }

        if (!confirm(`¿Estás seguro de eliminar la ${type === 'categories' ? 'categoría' : 'subcategoría'} "${name}"?`)) return;
        
        config[type].splice(index, 1);
        saveConfig();
    };

    // ---- Lógica de CRUD Productos (Fase 6 Soportado) ----
    const adminProductModal = document.getElementById('admin-product-modal');
    const productForm = document.getElementById('product-form');
    const stockLinesContainer = document.getElementById('stock-lines-container');

    document.getElementById('add-product-btn').addEventListener('click', () => {
        productForm.reset();
        document.getElementById('edit-product-id').value = '';
        document.getElementById('admin-modal-title').textContent = 'Nuevo Producto';
        currentProductImagesBase64 = [];
        renderImagePreviews();
        stockLinesContainer.innerHTML = ''; // Clean builder
        addStockLine(); // Add an initial empty line
        refreshDynamicUI();
        adminProductModal.classList.add('show');
        document.getElementById('app-container').classList.add('blur-background');
    });

    document.getElementById('add-stock-line-btn').addEventListener('click', () => addStockLine());
    document.getElementById('close-admin-modal').addEventListener('click', () => {
        adminProductModal.classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
    });
    document.getElementById('cancel-admin-modal').addEventListener('click', () => {
        adminProductModal.classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
    });

    document.getElementById('prod-images-upload').addEventListener('change', async (e) => {
        const files = e.target.files;
        for (let i = 0; i < files.length; i++) {
            const base64 = await fileToBase64(files[i]);
            currentProductImagesBase64.push({ url: base64, color: '' });
        }
        renderImagePreviews();
        e.target.value = ''; // Reset input
    });

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-product-id').value;
        const ref = document.getElementById('prod-ref').value;
        const name = document.getElementById('prod-name').value;
        const category = document.getElementById('prod-category').value;
        const subCategory = document.getElementById('prod-subcategory').value;
        const purchasePrice = parseFloat(document.getElementById('prod-purchase-price').value) || 0;
        const salePrice = parseFloat(document.getElementById('prod-sale-price').value) || 0;
        const imagesUrlArray = [...currentProductImagesBase64];
        const image = imagesUrlArray[0] ? imagesUrlArray[0].url : '';
        const description = document.getElementById('prod-desc').value;

        // VALIDACIÓN DE REFERENCIA DUPLICADA
        const existing = products.find(p => p.ref === ref && p.id != id);
        if (existing) {
            alert(`⚠️ ERROR DE REFERENCIA: Ya existe un producto con la referencia "${ref}" (${existing.name}). Por favor usa una referencia única.`);
            return;
        }

        // Extraer líneas de stock construidas
        const sizes = [];
        const lines = stockLinesContainer.querySelectorAll('.stock-line');
        lines.forEach(line => {
            const sizeInput = line.querySelector('.line-size').value.trim();
            const colorInput = line.querySelector('.line-color').value.trim();
            const stockInput = parseInt(line.querySelector('.line-stock').value) || 0;
            if (sizeInput && colorInput) sizes.push({ size: sizeInput, color: colorInput, stock: stockInput });
        });

        const newProd = {
            id: id ? parseInt(id) : Date.now(),
            ref, name, category, subCategory, purchasePrice, salePrice, 
            sizes, image, images: imagesUrlArray, description
        };

        if (id) {
            const index = products.findIndex(p => p.id == id);
            if (index !== -1) products[index] = newProd;
        } else {
            products.push(newProd);
        }

        await window.electronAPI.writeData('products.json', products);
        adminProductModal.classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
        renderAdminProducts();
    });

    window.editProduct = (id) => {
        const p = products.find(x => x.id == id);
        if (!p) return;

        document.getElementById('edit-product-id').value = p.id;
        document.getElementById('prod-ref').value = p.ref || '';
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-category').value = p.category.toLowerCase();
        
        // Update subcategory options forcibly before setting value
        const subSelect = document.getElementById('prod-subcategory');
        const filteredSubs = config.subcategories.filter(s => s.parent === p.category.toLowerCase());
        subSelect.innerHTML = filteredSubs.map(s => `<option value="${s.name.toLowerCase()}">${s.name}</option>`).join('');
        subSelect.value = p.subCategory ? p.subCategory.toLowerCase() : '';

        document.getElementById('prod-purchase-price').value = p.purchasePrice || 0;
        document.getElementById('prod-sale-price').value = p.salePrice || 0;
        // Phase 11: Map legacy strings to objects with empty color if needed
        currentProductImagesBase64 = p.images ? p.images.map(img => typeof img === 'string' ? {url: img, color: ''} : {...img}) : (p.image ? [{url: p.image, color: ''}] : []);
        renderImagePreviews();
        document.getElementById('prod-desc').value = p.description || '';

        // Poblar builder de Stock
        stockLinesContainer.innerHTML = '';
        if (p.sizes && p.sizes.length > 0) {
            p.sizes.forEach(sz => addStockLine(sz.size, sz.color || 'Único', sz.stock));
        } else {
            addStockLine();
        }

        document.getElementById('admin-modal-title').textContent = 'Editar Producto';
        adminProductModal.classList.add('show');
        document.getElementById('app-container').classList.add('blur-background');
    };

    window.deleteProduct = async (id) => {
        if (!confirm('⚠️ ¿Estás COMPLETAMENTE SEGURO de eliminar este producto? Se borrarán sus datos y existencias permanentemente.')) return;
        if (!confirm('❗ SEGUNDA CONFIRMACIÓN: Esta acción es irreversible y el producto desaparecerá del catálogo de inmediato. ¿Proceder?')) return;

        try {
            const res = await fetch(`/api/data/products.json/${id}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                alert('🚀 Producto eliminado exitosamente.');
                products = products.filter(p => p.id != id);
                renderAdminProducts();
            } else {
                alert('Error: ' + (result.error || 'No se pudo eliminar el producto'));
            }
        } catch (e) {
            console.error(e);
            alert('Error al conectar con el servidor.');
        }
    };

    // ---- Lógica Control de Stock Rápido (Fase 6) ----
    // ---- Lógica de Historial de Ventas ----
    document.getElementById('btn-apply-sales-filter').addEventListener('click', renderSales);
    document.getElementById('btn-clear-sales-filter').addEventListener('click', () => {
        document.getElementById('sales-filter-from').value = '';
        document.getElementById('sales-filter-to').value = '';
        document.getElementById('sales-filter-customer').value = '';
        document.getElementById('sales-filter-ticket').value = '';
        renderSales();
    });

    // ---- Lógica de Reportes Archivados ----
    document.getElementById('btn-save-filtered-report')?.addEventListener('click', async () => {
        if(!window.currentFilteredSales || window.currentFilteredSales.length === 0) return alert('No hay ventas filtradas para guardar en el reporte.');
        
        let tSales = 0; let tProfit = 0;
        window.currentFilteredSales.forEach(s => {
            tSales += (s.total || 0);
            tProfit += s.items.reduce((sum, item) => {
                const qty = item.qty || 1;
                const margin = (item.salePrice || 0) - (item.purchasePrice || 0);
                return sum + (margin * qty);
            }, 0);
        });
        
        const fromD = document.getElementById('sales-filter-from').value;
        const toD = document.getElementById('sales-filter-to').value;
        const rangeStr = (fromD ? fromD : 'Inicio') + ' a ' + (toD ? toD : 'Hoy');

        const newReport = {
            id: Date.now(),
            savedAt: new Date().toISOString(),
            dateRangeStr: rangeStr,
            salesCount: window.currentFilteredSales.length,
            totalSalesAmount: tSales,
            totalProfitAmount: tProfit,
            itemsDump: JSON.parse(JSON.stringify(window.currentFilteredSales))
        };
        
        window.reportsData.unshift(newReport); // Añadir al inicio del array local
        // FIX CRÍTICO: Enviar solo el nuevo reporte (el servidor lo inserta sin borrar los existentes)
        // Antes: mandaba todo el array → servidor hacía deleteMany+insertMany → se perdían reportes
        // Ahora: envía solo el objeto nuevo → servidor hace findOneAndUpdate (insert si no existe)
        await window.electronAPI.writeData('reports.json', newReport);
        alert('¡Reporte guardado exitosamente en la Bóveda de Historial!');
        
        // Simular clic en la pestaña de reportes
        document.querySelector('.admin-tab-btn[data-tab="reports"]')?.click();
    });

    document.getElementById('btn-apply-reports-filter')?.addEventListener('click', renderReports);

    document.getElementById('btn-clear-reports-vault')?.addEventListener('click', async () => {
        if (!confirm('⚠️ ¿Estás COMPLETAMENTE SEGURO de vaciar toda la Bóveda de Reportes? Esta acción no se puede deshacer.')) return;
        if (!confirm('❗ SEGUNDA CONFIRMACIÓN: Se eliminarán todos los reportes históricos permanentemente. ¿Proceder?')) return;

        try {
            const res = await fetch('/api/data/reports.json', { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                alert('🚀 Bóveda vaciada correctamente.');
                window.reportsData = [];
                renderReports();
            } else {
                alert('Error: ' + (result.error || 'No se pudo vaciar la bóveda'));
            }
        } catch (e) {
            console.error(e);
            alert('Error al conectar con el servidor.');
        }
    });
    // El botón de restablecer en HTML no tiene este ID exacto o los inputs tienen discrepancias
    document.getElementById('btn-clear-reports-filter')?.addEventListener('click', () => {
        const from = document.getElementById('reports-filter-from');
        const to = document.getElementById('reports-filter-to');
        if(from) from.value = '';
        if(to) to.value = '';
        renderReports();
    });

    document.getElementById('btn-export-reports-excel')?.addEventListener('click', () => window.exportFilteredReportsToExcel());

    // Botones de cierre de modales (Consolidados Premium)
    document.getElementById('close-admin-modal')?.addEventListener('click', () => {
        adminProductModal.classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
    });
    document.getElementById('cancel-admin-modal')?.addEventListener('click', () => {
        adminProductModal.classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
    });
    document.getElementById('btn-export-vault-excel')?.addEventListener('click', () => {
        window.exportFilteredReportsToExcel();
    });

    document.getElementById('close-sale-details-modal')?.addEventListener('click', () => {
        document.getElementById('sale-details-modal').classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
    });
    document.getElementById('close-report-details-modal')?.addEventListener('click', () => {
        document.getElementById('report-details-modal').classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
    });
    document.getElementById('close-quick-stock-modal')?.addEventListener('click', () => {
        document.getElementById('quick-stock-modal').classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
    });

    } catch (e) {
        alert("ERROR CRÍTICO EN ADMIN: " + e.message);
        console.error(e);
    }
});

// ================= GLOBAL EXPORTS & EXCEL =================

function exportToExcelBlob(html, fileName) {
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.style.display = 'none'; a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

document.getElementById('export-inventory-excel-btn')?.addEventListener('click', () => {
    const company = window.config?.company || {};
    let tableHtml = `<table border="1">`;
    if(company.name) {
        tableHtml += `<tr><th colspan="9" style="font-size:18px; background:#f3f4f6;">${company.name.toUpperCase()}</th></tr>`;
        tableHtml += `<tr><th colspan="9" style="font-size:12px; background:#f3f4f6;">NIT: ${company.nit||''} | Tel: ${company.phone||''} | Dir: ${company.address||''}</th></tr>`;
        tableHtml += `<tr><th colspan="9" style="height:10px;"></th></tr>`;
    }
    tableHtml += `<tr><th>Ref</th><th>Producto</th><th>Categoría</th><th>Subcategoría</th><th>Talla</th><th>Color</th><th>Costo Compra</th><th>Precio Venta</th><th>Cantidad (Stock)</th></tr>`;
    products.forEach(p => {
        if (p.sizes && p.sizes.length > 0) {
            p.sizes.forEach(sz => {
                tableHtml += `<tr><td>${p.ref||''}</td><td>${p.name}</td><td>${p.category}</td><td>${p.subCategory||''}</td><td>${sz.size}</td><td>${sz.color||'Único'}</td><td>${p.purchasePrice}</td><td>${p.salePrice}</td><td>${sz.stock}</td></tr>`;
            });
        } else {
            tableHtml += `<tr><td>${p.ref||''}</td><td>${p.name}</td><td>${p.category}</td><td>${p.subCategory||''}</td><td>N/A</td><td>Único</td><td>${p.purchasePrice}</td><td>${p.salePrice}</td><td>0</td></tr>`;
        }
    });
    tableHtml += '</table>';
    exportToExcelBlob(tableHtml, `inventario_completo_${new Date().toISOString().slice(0,10)}.xls`);
});

document.getElementById('btn-export-filtered-excel')?.addEventListener('click', () => {
    if(!window.currentFilteredSales || window.currentFilteredSales.length === 0) return alert('No hay ventas filtradas para exportar');
    
    const company = window.config?.company || {};
    let tableHtml = `<table border="1">`;
    if(company.name) {
        tableHtml += `<tr><th colspan="7" style="font-size:18px; background:#f3f4f6;">${company.name.toUpperCase()}</th></tr>`;
        tableHtml += `<tr><th colspan="7" style="font-size:12px; background:#f3f4f6;">NIT: ${company.nit||''} | Tel: ${company.phone||''} | Dir: ${company.address||''}</th></tr>`;
        tableHtml += `<tr><th colspan="7" style="height:10px;"></th></tr>`;
    }
    tableHtml += `<tr><th style="background:#1e293b; color:white;">ID VENTA</th><th style="background:#1e293b; color:white;">FECHA / HORA</th><th style="background:#1e293b; color:white;">CLIENTE</th><th style="background:#1e293b; color:white;">MÉTODO PAGO</th><th style="background:#1e293b; color:white;">CANT. ARTÍCULOS</th><th style="background:#1e293b; color:white;">T. FACTURADO</th><th style="background:#1e293b; color:white;">G. NETA</th></tr>`;
    
    let tSales = 0, tProfit = 0, tItems = 0;
    
    window.currentFilteredSales.forEach(s => {
        const dateStr = new Date(s.date).toLocaleString('es-CO', { hour12: true });
        
        let saleItemsCount = 0;
        let saleTotal = 0;
        let saleProfit = 0;

        s.items.forEach(item => {
            const qty = item.qty || 1;
            saleItemsCount += qty;
            saleTotal += (item.salePrice || 0) * qty;
            saleProfit += ((item.salePrice || 0) - (item.purchasePrice || 0)) * qty;
        });

        tSales += saleTotal;
        tProfit += saleProfit;
        tItems += saleItemsCount;

        tableHtml += `<tr>
            <td style="text-align:center;">#${s.id}</td>
            <td>${dateStr}</td>
            <td>${s.customerName || 'Consumidor Final'}</td>
            <td style="text-align:center;">${s.paymentMethod || 'No especificado'}</td>
            <td style="text-align:center;">${saleItemsCount}</td>
            <td style="text-align:right;">$${saleTotal.toLocaleString()}</td>
            <td style="text-align:right;">$${saleProfit.toLocaleString()}</td>
        </tr>`;
    });

    tableHtml += `<tr style="background:#f1f5f9; font-weight:bold;">
        <td colspan="4" style="text-align:right;">TOTALES GENERALES:</td>
        <td style="text-align:center;">${tItems}</td>
        <td style="text-align:right;">$${tSales.toLocaleString()}</td>
        <td style="text-align:right;">$${tProfit.toLocaleString()}</td>
    </tr></table>`;

    exportToExcelBlob(tableHtml, `historial_ventas_pedidos_${new Date().toISOString().slice(0,10)}.xls`);
});

document.getElementById('btn-export-consolidated-report')?.addEventListener('click', () => {
    if(!window.currentFilteredSales || window.currentFilteredSales.length === 0) return alert('No hay ventas filtradas para consolidar');
    
    // 1. Consolidar items
    const consolidated = {};
    window.currentFilteredSales.forEach(sale => {
        sale.items.forEach(item => {
            const key = `${item.ref || 'S/R'}-${item.name}-${item.selectedSize || 'N/A'}-${item.selectedColor || 'N/A'}`;
            if (!consolidated[key]) {
                consolidated[key] = {
                    ref: item.ref || 'S/R',
                    name: item.name,
                    variant: `Talla: ${item.selectedSize || 'N/A'} / Color: ${item.selectedColor || 'N/A'}`,
                    totalQty: 0
                };
            }
            consolidated[key].totalQty += (item.qty || 1);
        });
    });

    // 2. Generar HTML para Excel
    const company = window.config?.company || {};
    const fromD = document.getElementById('sales-filter-from').value;
    const toD = document.getElementById('sales-filter-to').value;
    const custF = document.getElementById('sales-filter-customer').value;
    const tickF = document.getElementById('sales-filter-ticket').value;

    let tableHtml = `<table border="1">`;
    if(company.name) {
        tableHtml += `<tr><th colspan="4" style="font-size:18px; background:#f3f4f6;">${company.name.toUpperCase()}</th></tr>`;
        tableHtml += `<tr><th colspan="4" style="font-size:12px; background:#f3f4f6;">NIT: ${company.nit||''} | Tel: ${company.phone||''} | Dir: ${company.address||''}</th></tr>`;
    }
    
    // Subtítulo con filtros aplicados
    let filtersStr = `📅 Rango: ${fromD || 'Inicio'} a ${toD || 'Hoy'}`;
    if(custF) filtersStr += ` | 👤 Cliente: ${custF}`;
    if(tickF) filtersStr += ` | 🎫 Ticket: #${tickF}`;
    
    tableHtml += `<tr><th colspan="4" style="font-size:11px; background:#f3f4f6;">${filtersStr}</th></tr>`;
    tableHtml += `<tr><th colspan="4" style="height:10px;"></th></tr>`;
    tableHtml += `<tr><th colspan="4" style="text-align:center; font-size:16px; background:#10b981; color:white;">REPORTE CONSOLIDADO PARA DESPACHO (PACKING LIST)</th></tr>`;
    tableHtml += `<tr><th style="background:#f3f4f6;">REFERENCIA</th><th style="background:#f3f4f6;">PRODUCTO</th><th style="background:#f3f4f6;">VARIANTE (TALLA/COLOR)</th><th style="background:#f3f4f6;">CANTIDAD TOTAL</th></tr>`;
    
    Object.values(consolidated).forEach(item => {
        tableHtml += `<tr><td>${item.ref}</td><td>${item.name}</td><td>${item.variant}</td><td style="text-align:center; font-weight:bold;">${item.totalQty}</td></tr>`;
    });
    
    tableHtml += `<tr><td colspan="3" style="text-align:right; font-weight:bold; background:#f3f4f6;">TOTAL ARTÍCULOS A DESPACHAR:</td><td style="text-align:center; font-weight:bold; background:#f3f4f6;">${Object.values(consolidated).reduce((sum, i) => sum + i.totalQty, 0)}</td></tr>`;
    tableHtml += '</table>';
    
    exportToExcelBlob(tableHtml, `consolidado_despacho_${new Date().toISOString().slice(0,10)}.xls`);
});

window.printSaleTicket = (id) => {
    const sale = window.salesData.find(s => s.id == id);
    if(!sale) return;
    const company = window.config?.company || {};
    const header = company.name ? `🏢 ${company.name.toUpperCase()}\nNIT: ${company.nit || ''}\n📍 ${company.address || ''}\n📞 ${company.phone || ''}\n` : 'COMPROBANTE DE VENTA';
    
    let txt = `================================\n${header}\n================================\n`;
    txt += `DATOS DEL CLIENTE:\n`;
    txt += `👤 Nombre: ${sale.customerName || 'Consumidor Final'}\n`;
    txt += `🆔 NIT/CC: ${sale.nit || 'N/A'}\n`;
    txt += `📞 Teléfono: ${sale.phone || 'N/A'}\n`;
    txt += `🏠 Dirección: ${sale.address || 'N/A'}\n`;
    txt += `📍 Ubicación: ${sale.city || ''}, ${sale.department || ''}\n`;
    txt += `💳 Pago: ${sale.paymentMethod || 'Efectivo'}\n`;
    txt += `================================\nTicket #: ${sale.id}\nFecha: ${new Date(sale.date).toLocaleString('es-ES')}\n\n`;
    
    sale.items.forEach(item => {
        const qty = item.qty || 1;
        const lineTotal = (item.salePrice || 0) * qty;
        txt += `[x${qty}] ${item.name}\nRef: ${item.ref||'S/R'} | Talla: ${item.selectedSize||'N/A'} | Color: ${item.selectedColor||'N/A'}\nSubtotal: $${lineTotal.toLocaleString()}\n--------------------------------\n`;
    });
    txt += `\nTOTAL PAGADO: $${sale.total.toLocaleString()}\n================================\n   ¡Gracias por su compra!      \n`;
    const blob = new Blob([txt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.style.display = 'none'; a.href = url; a.download = `comprobante_${id}.txt`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
};

window.exportSaleToExcel = (id, fromReportId = null) => {
    let sale;
    if(fromReportId) {
        const rep = window.reportsData.find(r => r.id == fromReportId);
        sale = rep?.itemsDump.find(x => x.id == id);
    } else {
        sale = window.salesData.find(s => s.id == id);
    }
    if(!sale) return;
    
    const company = window.config?.company || {};
    let totalProfit = 0;
    
    let table = `<table border="1">`;
    if(company.name) {
        table += `<tr><th colspan="7" style="font-size:18px; background:#f3f4f6;">${company.name.toUpperCase()}</th></tr>`;
        table += `<tr><th colspan="7" style="font-size:12px;">NIT: ${company.nit||''} | Tel: ${company.phone||''} | Dir: ${company.address||''}</th></tr>`;
        table += `<tr><th colspan="7" style="height:10px;"></th></tr>`;
    }
    table += `<tr><th colspan="7" style="text-align:center; font-size:16px; background:#4f46e5; color:white;">DETALLE DE VENTA #${sale.id}</th></tr>`;
    table += `<tr><td colspan="7"><b>CLIENTE:</b> ${sale.customerName || 'Consumidor Final'} | <b>NIT/CC:</b> ${sale.nit || 'N/A'}</td></tr>`;
    table += `<tr><td colspan="7"><b>TELÉFONO:</b> ${sale.phone || 'N/A'} | <b>DIRECCIÓN:</b> ${sale.address || 'N/A'}</td></tr>`;
    table += `<tr><td colspan="7"><b>UBICACIÓN:</b> ${sale.city || ''}, ${sale.department || ''} | <b>FECHA:</b> ${new Date(sale.date).toLocaleString('es-CO', { hour12: true })}</td></tr>`;
    table += `<tr><td colspan="7"><b>PAGO:</b> ${sale.paymentMethod || 'Efectivo'}</td></tr>`;
    table += `<tr><th colspan="7" style="height:10px;"></th></tr>`;
    table += `<tr><th>Ref</th><th>Producto</th><th>Variante (Talla/Color)</th><th>Cant.</th><th>P.Compra</th><th>P.Venta</th><th>Subtotal</th></tr>`;
    sale.items.forEach(item => {
        const qty = item.qty || 1;
        const lineTotal = (item.salePrice || 0) * qty;
        const lineProfit = ((item.salePrice||0) - (item.purchasePrice||0)) * qty;
        totalProfit += lineProfit;
        table += `<tr><td>${item.ref||'S/R'}</td><td>${item.name}</td><td>Talla: ${item.selectedSize||'N/A'} / Color: ${item.selectedColor||'N/A'}</td><td>${qty}</td><td>$${item.purchasePrice||0}</td><td>$${item.salePrice||0}</td><td>$${lineTotal}</td></tr>`;
    });
    table += `<tr><td colspan="5"></td><td><b>TOTAL FACTURA:</b></td><td><b>$${sale.total.toLocaleString()}</b></td></tr>`;
    table += `<tr><td colspan="5"></td><td><b>GANANCIA NETA:</b></td><td><b style="color:green;">$${totalProfit}</b></td></tr></table>`;
    exportToExcelBlob(table, `copia_${sale.id}.xls`);
};

window.deleteSaleAndRestore = async (id, fromModal = false) => {
    if(!confirm('¿Estás seguro de efectuar la DEVOLUCIÓN? Las existencias físicas volverán al stock oficial y se eliminará este registro mercantil de la facturación.')) return;
    const saleIndex = window.salesData.findIndex(s => s.id == id);
    if(saleIndex === -1) return;
    const sale = window.salesData[saleIndex];
    
    // RESTORE STOCK OPERATION (respecting qty)
    let currentProducts = await window.electronAPI.readData('products.json') || [];
    sale.items.forEach(item => {
        const qty = item.qty || 1;
        const pIndex = currentProducts.findIndex(p => p.id === item.id);
        if(pIndex !== -1 && currentProducts[pIndex].sizes) {
            currentProducts[pIndex].sizes = currentProducts[pIndex].sizes.map(sz => {
                if(typeof sz === 'object' && sz.size === item.selectedSize && sz.color === item.selectedColor) {
                    return { ...sz, stock: sz.stock + qty };
                }
                return sz;
            });
        }
    });
    await window.electronAPI.writeData('products.json', currentProducts);
    products = currentProducts;
    
    // REMOVE REGISTRATION
    window.salesData.splice(saleIndex, 1);
    await window.electronAPI.writeData('sales.json', window.salesData);
    
    if(fromModal) {
        document.getElementById('sale-details-modal').classList.remove('show');
        document.getElementById('app-container').classList.remove('blur-background');
    }
    renderSales();
    renderAdminProducts();
    alert('Devolución completada. Stock restaurado.');
};

document.getElementById('btn-clear-sales-history')?.addEventListener('click', async () => {
    if(!confirm('⛔ CUIDADO: Estás a punto de borrar TODO tu historial visible de ventas permanentemente. Esto vaciará tus registros como cierre de caja, pero TU INVENTARIO SE MANTENDRÁ INTACTO en todo momento. ¿Deseas Limpiar la Caja Fuerte?')) return;
    window.salesData = [];
    await window.electronAPI.writeData('sales.json', window.salesData);
    renderSales();
});

// ================= FUNCIONES GLOBALES =================

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

window.removePreviewImage = (index) => {
    currentProductImagesBase64.splice(index, 1);
    renderImagePreviews();
};

window.updatePreviewColor = (index, val) => {
    if(currentProductImagesBase64[index]) {
        currentProductImagesBase64[index].color = val;
    }
};

function renderImagePreviews() {
    const container = document.getElementById('image-preview-container');
    if(!container) return;
    container.innerHTML = currentProductImagesBase64.map((obj, i) => `
        <div style="position:relative; width:80px; flex-shrink:0; display:flex; flex-direction:column; gap:5px;">
            <div style="position:relative; width:80px; height:80px;">
                <img src="${obj.url}" style="width:100%; height:100%; object-fit:cover; border-radius:12px; border:2px solid ${i === 0 ? 'var(--primary)' : 'var(--glass-border)'};">
                <button type="button" onclick="removePreviewImage(${i})" style="position:absolute; top:-6px; right:-6px; background:var(--accent); color:var(--text-dark); border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; font-size:12px; font-weight:bold; display:flex; justify-content:center; align-items:center; box-shadow:var(--shadow-sm);">X</button>
                ${i === 0 ? '<span style="position:absolute; bottom:0; left:0; right:0; background:rgba(168, 85, 247, 0.9); color:var(--text-dark); font-size:10px; font-weight:bold; text-align:center; padding:3px; border-bottom-left-radius:10px; border-bottom-right-radius:10px;">Portada</span>' : ''}
            </div>
            <input type="text" placeholder="Color..." value="${obj.color || ''}" onchange="updatePreviewColor(${i}, this.value)" style="width:100%; padding:4px; font-size:0.7rem; color:var(--text-main); background:rgba(255,255,255,0.05); text-align:center; border:1px solid var(--glass-border); border-radius:6px; outline:none;" title="Asigna un color a esta imagen">
        </div>
    `).join('');
}

async function saveConfig() {
    await window.electronAPI.writeData('config.json', config);
    renderCategorySettings();
    refreshDynamicUI();
}

function refreshDynamicUI() {
    const catSelect = document.getElementById('prod-category');
    const subSelect = document.getElementById('prod-subcategory');
    const subParentSelect = document.getElementById('new-subcategory-parent');
    
    if(!catSelect) return;

    const catOptions = config.categories.map(c => `<option value="${c.toLowerCase()}">${c}</option>`).join('');
    catSelect.innerHTML = catOptions;
    if(subParentSelect) subParentSelect.innerHTML = catOptions;

    const updateSubOptions = () => {
        if(!subSelect) return;
        const selectedCat = catSelect.value;
        const filteredSubs = config.subcategories.filter(s => s.parent === selectedCat);
        subSelect.innerHTML = filteredSubs.map(s => `<option value="${s.name.toLowerCase()}">${s.name}</option>`).join('');
    };

    catSelect.onchange = updateSubOptions;
    updateSubOptions();
}

function renderCategorySettings() {
    const treeContainer = document.getElementById('category-tree-container');
    if(!treeContainer) return;
    
    if (config.categories.length === 0) {
        treeContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No hay categorías creadas aún.</p>';
        return;
    }

    treeContainer.innerHTML = config.categories.map((cat, catIdx) => {
        const catLower = cat.toLowerCase();
        const relatedSubs = config.subcategories.filter(s => s.parent === catLower);
        
        return `
            <div class="category-group" style="margin-bottom: 12px; border: 1px solid var(--glass-border); border-radius: 14px; overflow: hidden; background: rgba(15, 23, 42, 0.4);">
                <div class="category-group-header" style="padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; background: rgba(59, 130, 246, 0.08); cursor: pointer;" onclick="const content = this.nextElementSibling; const icon = this.querySelector('.toggle-icon'); const isOpen = content.style.display !== 'none'; content.style.display = isOpen ? 'none' : 'block'; icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fas fa-chevron-right toggle-icon" style="transition: transform 0.3s ease; color: var(--primary-light); font-size: 0.8rem;"></i>
                        <span style="font-weight: 700; color: var(--text-main); text-transform: capitalize;">${cat}</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 8px;">${relatedSubs.length} sub</span>
                    </div>
                    <button onclick="event.stopPropagation(); removeConfigItem('categories', ${catIdx})" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: none; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='white'"><i class="fas fa-trash-alt" style="font-size: 0.8rem;"></i></button>
                </div>
                
                <div class="category-group-content" style="padding: 15px; border-top: 1px solid var(--glass-border); display: none;">
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${relatedSubs.length > 0 ? relatedSubs.map(s => {
                            const originalIdx = config.subcategories.findIndex(sub => sub.name === s.name && sub.parent === s.parent);
                            return `
                                <div class="chip-premium" style="padding: 6px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: 50px; display: flex; align-items: center; gap: 8px; font-size: 0.85rem;">
                                    <span style="text-transform: capitalize;">${s.name}</span>
                                    <button onclick="removeConfigItem('subcategories', ${originalIdx})" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 2px;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text-muted)'"><i class="fas fa-times"></i></button>
                                </div>
                            `;
                        }).join('') : '<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; margin: 0 auto;">Sin subcategorías.</p>'}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function addStockLine(size = '', color = '', stock = 0) {
    const container = document.getElementById('stock-lines-container');
    const line = document.createElement('div');
    line.className = 'stock-line';
    line.innerHTML = `
        <div style="flex:1;">
            <label style="font-size: 0.75rem; color: #64748b; font-weight: 600; margin-bottom: 4px; display: block;">Talla / Tamaño</label>
            <input type="text" class="line-size" placeholder="Ej: S, 38, L" value="${size}" style="width:100%;" required>
        </div>
        <div style="flex:1;">
            <label style="font-size: 0.75rem; color: #64748b; font-weight: 600; margin-bottom: 4px; display: block;">Color / Tono</label>
            <input type="text" class="line-color" placeholder="Ej: Rojo, Azul" value="${color}" style="width:100%;" required>
        </div>
        <input type="hidden" class="line-stock" value="${stock}">
        <button type="button" class="btn-remove-line" title="Eliminar Variante"><i class="fas fa-trash-alt"></i></button>
    `;
    line.querySelector('.btn-remove-line').addEventListener('click', () => {
        line.style.opacity = '0';
        line.style.transform = 'scale(0.9)';
        setTimeout(() => line.remove(), 300);
    });
    container.appendChild(line);
}

function renderAdminProducts() {
    const list = document.getElementById('admin-product-list');
    if(!list) return;
    list.innerHTML = '';
    products.forEach(p => {
        // Construir string visual de stock
        let stockHtml = p.sizes && p.sizes.length > 0 
            ? p.sizes.map(s => `<span class="chip-premium" style="background:${s.stock > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color:${s.stock > 0 ? '#10b981' : '#ef4444'}; padding:4px 10px; font-size:0.75rem;">${s.size} | ${s.color || 'Único'}: <b>${s.stock}</b></span>`).join('')
            : '<span style="color:#94a3b8">Sin Variantes</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Producto"><strong>${p.name}</strong><br><small style="color:#64748b">${p.ref || 'SIN-REF'}</small></td>
            <td data-label="Categoría"><span class="chip-premium" style="background:rgba(99, 102, 241, 0.05);">${p.category} / ${p.subCategory}</span></td>
            <td data-label="Stock" style="max-width: 250px;">${stockHtml}</td>
            <td data-label="Precio"><strong style="color:var(--primary);">$${(p.salePrice || 0).toLocaleString()}</strong><br><small>Costo: $${(p.purchasePrice || 0).toLocaleString()}</small></td>
            <td data-label="Acciones">
                <div class="admin-actions" style="display: flex; gap: 8px;">
                    <button class="btn-premium-s" style="padding: 8px 12px;" title="Editar" onclick="editProduct(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-premium-d" style="padding: 8px 12px;" title="Borrar" onclick="deleteProduct(${p.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        list.appendChild(tr);
    });
}

function renderQuickStockList() {
    const list = document.getElementById('quick-stock-list');
    if (!list) return;
    list.innerHTML = '';
    products.forEach(p => {
        if(p.sizes && p.sizes.length > 0) {
            p.sizes.forEach(sz => {
                const tr = document.createElement('tr');
                const dangerColor = sz.stock === 0 ? 'background: rgba(239, 68, 68, 0.1); color: #ef4444; font-weight:700;' : '';
                tr.innerHTML = `
                    <td><strong>${p.name}</strong> <small>(${p.ref || 'S/R'})</small></td>
                    <td><span class="chip-premium" style="padding: 4px 12px; font-size: 0.8rem;">${sz.color || 'Único'}</span></td>
                    <td><span class="chip-premium" style="padding: 4px 12px; font-size: 0.8rem; background: rgba(99, 102, 241, 0.05);">${sz.size}</span></td>
                    <td><span style="padding: 6px 12px; border-radius: 8px; ${dangerColor}">${sz.stock > 0 ? sz.stock + ' Unds' : 'Agotado'}</span></td>
                    <td>
                        <input type="number" class="quick-stock-input" data-pid="${p.id}" data-size="${sz.size}" data-color="${sz.color || 'Único'}" value="${sz.stock}" min="0" style="padding:10px; border-radius:10px; border:1px solid var(--glass-border); background:rgba(255,255,255,0.05); color:var(--text-main); width:100px; text-align:center;">
                    </td>
                `;
                list.appendChild(tr);
            });
        }
    });
}

    window.salesData = [];
    window.currentFilteredSales = []; // Caching for excel exports
    window.reportsData = [];

    async function loadSales() {
        window.salesData = await window.electronAPI.readData('sales.json') || [];
        renderSales();
    }

    function renderSales() {
        const list = document.getElementById('admin-sales-list');
        const footer = document.getElementById('sales-summary-footer');
        list.innerHTML = '';
        
        const fromDate = document.getElementById('sales-filter-from').value;
        const toDate = document.getElementById('sales-filter-to').value;
        const customerFilter = document.getElementById('sales-filter-customer').value.toLowerCase().trim();
        const ticketFilter = document.getElementById('sales-filter-ticket').value.trim();

        let filtered = window.salesData;
        
        if (ticketFilter) {
            filtered = filtered.filter(s => s.id.toString().includes(ticketFilter));
        }
        if (fromDate && !ticketFilter) {
            const [y, m, d] = fromDate.split('-').map(Number);
            const start = new Date(y, m - 1, d, 0, 0, 0, 0); // Start of day Local
            filtered = filtered.filter(s => new Date(s.date) >= start);
        }
        if (toDate && !ticketFilter) {
            const [y, m, d] = toDate.split('-').map(Number);
            const end = new Date(y, m - 1, d, 23, 59, 59, 999); // End of day Local
            filtered = filtered.filter(s => new Date(s.date) <= end);
        }
        if (customerFilter && !ticketFilter) {
            filtered = filtered.filter(s => (s.customerName || 'Consumidor Final').toLowerCase().includes(customerFilter));
        }

        // ORDENAR: De más reciente a más antiguo
        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        window.currentFilteredSales = filtered; // Save state for Export
        
        let totalSales = 0;
        let totalProfit = 0;

        filtered.forEach(s => {
            const dateStr = new Date(s.date).toLocaleString('es-CO', { 
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', hour12: true
            });

            // Agrupar items
            let itemsCount = 0;
            let saleProfit = 0;

            s.items.forEach(item => {
                const qty = item.qty || 1;
                itemsCount += qty;
                const unitProfit = ((item.salePrice || 0) - (item.purchasePrice || 0)) * qty;
                saleProfit += unitProfit;
            });
            
            totalProfit += saleProfit;
            totalSales += s.total;
            
            const tr = document.createElement('tr');
            const hasReceipt = s.receipt ? true : false;
            tr.innerHTML = `
                <td data-label="ID Venta"><strong style="color: #475569;">#${s.id}</strong></td>
                <td data-label="Fecha">${dateStr}</td>
                <td data-label="Cliente"><span class="chip-premium" style="background: rgba(99, 102, 241, 0.05);">${s.customerName || 'Consumidor Final'}</span></td>
                <td data-label="Pago"><span class="chip-premium" style="background: rgba(16, 185, 129, 0.1); color: #10b981; font-size: 0.75rem;">${s.paymentMethod || 'Efectivo'}</span></td>
                <td data-label="Arts" style="text-align:center;"><span class="chip-premium" style="padding: 2px 10px; font-weight:bold;">${itemsCount}</span></td>
                <td data-label="Total"><strong style="color: var(--primary);">$${(s.total).toLocaleString()}</strong></td>
                <td data-label="Ganancia"><strong style="color: var(--success);">$${saleProfit.toLocaleString()}</strong></td>
                <td data-label="Acciones" style="text-align:center;">
                    <div style="display: flex; gap: 8px; justify-content: center;">
                        <button class="btn-premium-s" style="padding: 8px 12px;" title="Ver Detalles" onclick="openSaleDetails(${s.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${hasReceipt ? `<button class="btn-premium-p" style="padding: 8px 12px; background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2);" title="Ver Recibo" onclick="window.viewReceipt('${s.receipt}')"><i class="fas fa-receipt"></i></button>` : ''}
                    </div>
                </td>
            `;
            list.appendChild(tr);
        });

    if (filtered.length === 0) {
        list.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px;">No hay registros o no coinciden con las fechas.</td></tr>';
        footer.innerHTML = '';
        return;
    }

    const profit = totalSales - totalProfit; // totalProfit here is sum of unit profits, not total cost
    footer.innerHTML = `
        <div class="summary-card">
            <strong>RESUMEN FINANCIERO (Rango actual):</strong>
            <div style="display:flex; gap: 20px;">
                <span>Ingresos Brutos: <strong>$${totalSales.toLocaleString()}</strong></span>
                <span>Ganancia Neta: <strong class="${totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}">$${totalProfit.toLocaleString()}</strong></span>
            </div>
        </div>
    `;
}

window.openSaleDetails = (saleId, fromReportId = null) => {
    let s;
    if(fromReportId) {
        const rep = window.reportsData.find(r => r.id == fromReportId);
        s = rep?.itemsDump.find(x => x.id == saleId);
    } else {
        s = window.salesData.find(x => x.id == saleId);
    }
    
    if(!s) return;
    
    document.getElementById('detail-modal-title').textContent = `Detalles del Pedido #${s.id}`;
    const transactionLink = s.receipt ? `<button class="chip-premium" style="background:rgba(16, 185, 129, 0.1); color:#10b981; padding:2px 10px; border:1px solid #10b981; cursor:pointer; font-weight:700;" onclick="window.viewReceipt('${s.receipt}')"><i class="fas fa-file-invoice-dollar"></i> Transacción: ${s.paymentMethod || 'Efectivo'}</button>` : `<span class="chip-premium" style="background:rgba(255,255,255,0.05); color:var(--text-muted); padding:2px 8px;">${s.paymentMethod || 'Efectivo'} (Sin Recibo)</span>`;

    document.getElementById('detail-modal-subtitle').innerHTML = `
        👤 <b>Cliente:</b> ${s.customerName || 'Consumidor Final'}<br>
        🆔 <b>NIT/CC:</b> ${s.nit || 'N/A'} | 📞 <b>Tel:</b> ${s.phone || 'N/A'}<br>
        📍 <b>Ubicación:</b> ${s.city || ''}, ${s.department || ''}<br>
        🏠 <b>Dirección:</b> ${s.address || 'N/A'}<br>
        📅 <b>Fecha:</b> ${new Date(s.date).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'short', hour12: true })}<br>
        💳 <b>Método de Pago:</b> ${transactionLink}
        ${fromReportId ? '<br><span style="color:#f59e0b;">(Registro Histórico de Bóveda)</span>' : ''}
    `;
    
    const list = document.getElementById('sale-details-list');
    list.innerHTML = '';
    
    let saleProfit = 0;
    
    s.items.forEach(item => {
        const qty = item.qty || 1;
        const profit = ((item.salePrice || 0) - (item.purchasePrice || 0)) * qty;
        saleProfit += profit;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="chip-premium" style="background: rgba(168, 85, 247, 0.05); color:var(--text-muted);">${item.ref || 'S/R'}</span></td>
            <td><strong>${item.name}</strong></td>
            <td>Talla: ${item.selectedSize || 'N/A'}<br>Color: ${item.selectedColor || 'N/A'}</td>
            <td style="text-align:center;"><strong style="color:var(--primary);">x${qty}</strong></td>
            <td>$${(item.salePrice || 0).toLocaleString()}</td>
            <td><strong>$${((item.salePrice || 0) * qty).toLocaleString()}</strong></td>
        `;
        list.appendChild(tr);
    });
    
    const receiptHtml = s.receipt ? `
        <div style="margin-top: 15px; border-top: 1px solid var(--glass-border); padding-top: 15px; text-align: center;">
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px;">🖼️ Recibo de Pago Adjunto:</p>
            <img src="${s.receipt}" style="max-width: 100%; border-radius: 12px; border: 1px solid var(--glass-border); cursor: zoom-in;" onclick="window.viewReceipt(this.src)">
        </div>
    ` : '';

    document.getElementById('sale-details-footer').innerHTML = `
        <div style="font-size:1.1rem;">Total Facturado: <strong style="color:var(--primary);">$${s.total.toLocaleString()}</strong></div>
        <div style="font-size:0.9rem; color:var(--text-muted); margin-top:5px;">Ganancia Neta: <strong style="color:var(--success);">+$${saleProfit.toLocaleString()}</strong></div>
        ${receiptHtml}
    `;
    
    // Actions con Layout corregido
    const actionsContainer = document.getElementById('sale-details-actions');
    actionsContainer.style.display = 'flex';
    actionsContainer.style.flexWrap = 'wrap';
    actionsContainer.style.gap = '10px';
    actionsContainer.style.justifyContent = 'flex-end';

    if (fromReportId) {
        actionsContainer.innerHTML = `
            <button class="btn-icon btn-view" style="width:auto; padding:8px 15px;" title="Imprimir Ticket" onclick="printTicketDirectly(${s.id}, ${fromReportId})"><i class="fas fa-print"></i> Ticket</button>
            <button class="btn-icon btn-excel-sm" style="width:auto; padding:8px 15px;" title="Excel" onclick="exportSaleToExcel(${s.id}, ${fromReportId})"><i class="fas fa-file-excel"></i> Excel</button>
            <button class="btn-icon btn-delete-sm" style="width:auto; padding:8px 15px;" title="Eliminar" onclick="deleteSaleFromReport(${s.id}, ${fromReportId})"><i class="fas fa-trash"></i> Borrar</button>
        `;
    } else {
        actionsContainer.innerHTML = `
            <button class="btn-icon btn-view" style="width:auto; padding:8px 15px;" title="Imprimir" onclick="printTicketDirectly(${s.id})"><i class="fas fa-print"></i> Ticket</button>
            <button class="btn-icon btn-view" style="width:auto; padding:8px 15px;" title="TXT" onclick="printSaleTicket(${s.id})"><i class="fas fa-file-alt"></i> TXT</button>
            <button class="btn-icon btn-excel-sm" style="width:auto; padding:8px 15px;" title="Excel" onclick="exportSaleToExcel(${s.id})"><i class="fas fa-file-excel"></i> Excel</button>
            <button class="btn-icon btn-delete-sm" style="width:auto; padding:8px 15px; background:#f43f5e; color:white;" title="Devolución" onclick="deleteSaleAndRestore(${s.id}, true)"><i class="fas fa-undo"></i> Devolución</button>
        `;
    }
    
    document.getElementById('sale-details-modal').classList.add('show');
    document.getElementById('app-container').classList.add('blur-background');
};

// (Listeners movidos al bloque DOMContentLoaded principal)

window.viewReceipt = (base64) => {
    if(!base64) return;
    const win = window.open("");
    win.document.write(`
        <html>
            <body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center;">
                <img src="${base64}" style="max-width:100%; max-height:100vh; box-shadow: 0 0 50px rgba(0,0,0,0.5);">
                <div style="position:fixed; top:20px; right:20px; color:white; font-family:sans-serif; background:rgba(0,0,0,0.5); padding:10px 20px; border-radius:30px; cursor:pointer;" onclick="window.close()">Cerrar Vista</div>
            </body>
        </html>
    `);
};

function exportToExcelBlob(html, fileName) {
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ==== REPORTERÍA HISTÓRICA (FASE 13) ====
async function loadReports() {
    window.reportsData = await window.electronAPI.readData('reports.json') || [];
    renderReports();
}

function renderReports() {
    const list = document.getElementById('admin-reports-list');
    const footer = document.getElementById('reports-summary-footer');
    if(!list) return;
    list.innerHTML = '';
    
    const fromDate = document.getElementById('reports-filter-from').value;
    const toDate = document.getElementById('reports-filter-to').value;
    
    let filtered = window.reportsData;
    
    if (fromDate) {
        const [y, m, d] = fromDate.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0); 
        filtered = filtered.filter(r => new Date(r.savedAt) >= start);
    }
    if (toDate) {
        const [y, m, d] = toDate.split('-').map(Number);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        filtered = filtered.filter(r => new Date(r.savedAt) <= end);
    }
    
    // ORDENAR: De más reciente a más antiguo
    filtered.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    
    window.currentFilteredReports = filtered; // Guardar estado para exportación
    
    let totalMonthlySales = 0;
    let totalMonthlyProfit = 0;
    
    filtered.forEach(r => {
        const dStr = new Date(r.savedAt).toLocaleString('es-CO', { hour12: true });
        totalMonthlySales += r.totalSalesAmount;
        totalMonthlyProfit += r.totalProfitAmount;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Guardado"><strong>${dStr}</strong></td>
            <td data-label="Rango"><span class="chip-premium" style="padding: 4px 12px; font-size: 0.8rem;">${r.dateRangeStr}</span></td>
            <td data-label="Tickets">${r.salesCount} Tickets</td>
            <td data-label="Ventas">$${r.totalSalesAmount.toLocaleString()}</td>
            <td data-label="Ganancia"><strong style="color: var(--success);">$${r.totalProfitAmount.toLocaleString()}</strong></td>
            <td data-label="Acciones">
                <div class="admin-actions" style="display: flex; gap: 8px; justify-content: center;">
                    <button class="btn-premium-s" style="padding: 8px 15px;" title="Ver Detalles" onclick="openReportDetails(${r.id})"><i class="fas fa-eye"></i> Ver</button>
                    <button class="btn-premium-p" style="padding: 8px 12px; background: #10b981;" title="Excel" onclick="exportSavedReportToExcel(${r.id})"><i class="fas fa-file-excel"></i></button>
                    <button class="btn-premium-d" style="padding: 8px 12px;" title="Borrar" onclick="deleteSavedReport(${r.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        list.appendChild(tr);
    });
    
    if(filtered.length === 0){
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">No hay reportes archivados para el rango seleccionado.</td></tr>';
        footer.innerHTML = '';
    } else {
        footer.innerHTML = `
        <div class="summary-card">
            <strong>CONSOLIDADO GLOBAL DE BÓVEDA (Reportes Mostrados):</strong>
            <div style="display:flex; gap: 20px;">
                <span>Facturación Bruta: <strong>$${totalMonthlySales.toLocaleString()}</strong></span>
                <span>Ganancia Neta: <strong style="color:var(--success);">$${totalMonthlyProfit.toLocaleString()}</strong></span>
            </div>
        </div>
        `;
    }
}

// Lógica de Exportación Global para Reportes de Bóveda
window.exportFilteredReportsToExcel = () => {
    if (!window.currentFilteredReports || window.currentFilteredReports.length === 0) {
        return alert('No hay reportes para exportar en el rango seleccionado.');
    }
    
    const company = window.config?.company || {};
    let table = `<table border="1">`;
    if(company.name) {
        table += `<tr><th colspan="5" style="font-size:18px; background:#f3f4f6;">${company.name.toUpperCase()}</th></tr>`;
        table += `<tr><th colspan="5" style="font-size:12px; background:#f3f4f6;">NIT: ${company.nit||''} | Tel: ${company.phone||''} | Dir: ${company.address||''}</th></tr>`;
        table += `<tr><th colspan="5" style="height:10px;"></th></tr>`;
    }
    table += `<tr><th colspan="5" style="font-size:1.2rem; padding:10px; background:#4f46e5; color:white;">HISTORIAL DE REPORTES - SISTEMA CONTABLE</th></tr>`;
        table += `<tr style="font-weight:bold;">
            <th style="padding:10px;">FECHA DE GUARDADO</th>
            <th style="padding:10px;">RANGO AUDITABLE</th>
            <th style="padding:10px;">VOLUMEN DE TICKETS</th>
            <th style="padding:10px;">FACTURACIÓN BRUTA</th>
            <th style="padding:10px;">GANANCIA NETA</th>
        </tr>`;
        
    window.currentFilteredReports.forEach(r => {
        const dStr = new Date(r.savedAt).toLocaleString('es-CO', { hour12: true });
        table += `<tr>
            <td style="padding:8px;">${dStr}</td>
            <td style="padding:8px;">${r.dateRangeStr}</td>
            <td style="padding:8px; text-align:center;">${r.salesCount} Tickets</td>
            <td style="padding:8px;">$${r.totalSalesAmount.toLocaleString()}</td>
            <td style="padding:8px; font-weight:bold;">$${r.totalProfitAmount.toLocaleString()}</td>
        </tr>`;
    });
    
    const totalSales = window.currentFilteredReports.reduce((s, r) => s + r.totalSalesAmount, 0);
    const totalProfit = window.currentFilteredReports.reduce((s, r) => s + r.totalProfitAmount, 0);
    
    table += `<tr style="font-weight:bold;">
        <td colspan="3" style="text-align:right; padding:10px;">CONSOLIDADO DE SELECCIÓN:</td>
        <td style="padding:10px;">$${totalSales.toLocaleString()}</td>
        <td style="padding:10px;">$${totalProfit.toLocaleString()}</td>
    </tr>`;
    
    table += "</table>";
    exportToExcelBlob(table, `reportes_historia_${Date.now()}.xls`);
};




window.openReportDetails = (reportId) => {
    const r = window.reportsData.find(x => x.id == reportId);
    if(!r) return;
    
    document.getElementById('report-detail-title').textContent = `Ventas del Reporte Histórico #${r.id}`;
    document.getElementById('report-detail-subtitle').innerHTML = `📅 <b>Guardado el:</b> ${new Date(r.savedAt).toLocaleString('es-CO', { hour12: true })} | 🕒 <b>Rango:</b> ${r.dateRangeStr}`;
    
    const list = document.getElementById('report-sales-list');
    list.innerHTML = '';
    
    r.itemsDump.forEach(s => {
        let itemsCount = s.items.reduce((sum, item) => sum + (item.qty || 1), 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong style="color: var(--text-muted);">#${s.id}</strong></td>
            <td>${new Date(s.date).toLocaleString('es-CO', { hour12: true })}</td>
            <td>${s.customerName || 'Consumidor Final'}</td>
            <td style="text-align:center;"><span class="category-badge">${itemsCount}</span></td>
            <td><strong>$${(s.total).toLocaleString()}</strong></td>
            <td style="text-align:center;">
                <div style="display:flex; gap:8px; justify-content:center;">
                    <button class="btn-premium-s" style="padding: 8px 12px;" title="Ver Venta" onclick="openSaleDetails(${s.id}, ${r.id})"><i class="fas fa-eye"></i></button>
                    <button class="btn-premium-p" style="padding: 8px 12px; background: #10b981;" title="Excel" onclick="exportSaleToExcel(${s.id}, ${r.id})"><i class="fas fa-file-excel"></i></button>
                    <button class="btn-premium-d" style="padding: 8px 12px;" title="Borrar de Reporte" onclick="deleteSaleFromReport(${s.id}, ${r.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        list.appendChild(tr);
    });
    
    document.getElementById('report-details-modal').classList.add('show');
    document.getElementById('app-container').classList.add('blur-background');
};

window.printTicketDirectly = (saleId, fromReportId = null) => {
    let s;
    if(fromReportId) {
        const rep = window.reportsData.find(r => r.id == fromReportId);
        s = rep?.itemsDump.find(x => x.id == saleId);
    } else {
        s = window.salesData.find(x => x.id == saleId);
    }
    if(!s) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    const itemsHtml = s.items.map(item => {
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

    const company = window.config?.company || {};
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
                .info { margin-bottom: 10px; }
            </style>
        </head>
        <body onload="window.print();">
            <div class="header">
                ${companyHtml}
                <h2 style="margin:5px 0; font-size: 14px;">ORDEN DE COMPRA</h2>
                <div style="font-size: 12px; font-weight: bold;">Ticket #${s.id}</div>
            </div>
            <div class="info">
                <div style="border-top: 1px dashed #000; padding-top: 5px; margin-bottom: 5px;">
                    <div><b>CLIENTE:</b> ${s.customerName || 'Consumidor Final'}</div>
                    <div><b>NIT/CC:</b> ${s.nit || 'N/A'}</div>
                    <div><b>TELÉFONO:</b> ${s.phone || 'N/A'}</div>
                    <div><b>DIRECCIÓN:</b> ${s.address || 'N/A'}</div>
                    <div><b>UBICACIÓN:</b> ${s.city || ''}, ${s.department || ''}</div>
                    <div><b>PAGO:</b> ${s.paymentMethod || 'Efectivo'}</div>
                </div>
                <div style="border-top: 1px dashed #000; padding-top: 5px;">
                    <div><b>FECHA:</b> ${new Date(s.date).toLocaleString('es-CO', { hour12: true })}</div>
                </div>
            </div>
            <div style="border-top: 1px solid #000; padding-top: 10px;">
                ${itemsHtml}
            </div>
            <div class="total">TOTAL: $${s.total.toLocaleString()}</div>
            <div class="footer">
                ¡Gracias por preferirnos!<br>
                Software Contable - v1.0
            </div>
        </body>
        </html>
    `);
    doc.close();

    setTimeout(() => { document.body.removeChild(iframe); }, 3000);
};

window.deleteSaleFromReport = async (saleId, reportId) => {
    if(!confirm('¿Estás seguro de ELIMINAR esta venta específica de este reporte archivado? (Esto recalculará los totales del reporte pero NO afectará el inventario real)')) return;
    
    const repIndex = window.reportsData.findIndex(r => r.id == reportId);
    if(repIndex === -1) return;
    
    const rep = window.reportsData[repIndex];
    const saleIndex = rep.itemsDump.findIndex(s => s.id == saleId);
    if(saleIndex === -1) return;
    
    // Remove sale
    rep.itemsDump.splice(saleIndex, 1);
    
    // Recalculate report totals
    rep.salesCount = rep.itemsDump.length;
    rep.totalSalesAmount = rep.itemsDump.reduce((sum, s) => sum + s.total, 0);
    rep.totalProfitAmount = rep.itemsDump.reduce((sum, s) => {
        let p = s.items.reduce((pSum, item) => pSum + (((item.salePrice || 0) - (item.purchasePrice || 0)) * (item.qty || 1)), 0);
        return sum + p;
    }, 0);
    
    await window.electronAPI.writeData('reports.json', window.reportsData);
    
    openReportDetails(reportId); // Refresh modal
    renderReports(); // Refresh main table
};

window.exportSavedReportToExcel = (id) => {
    const rep = window.reportsData.find(r => r.id == id);
    if(!rep) return;
    const company = window.config?.company || {};
    let tableHtml = `<table border="1">`;
    if(company.name) {
        tableHtml += `<tr><th colspan="7" style="font-size:18px; background:#f3f4f6;">${company.name.toUpperCase()}</th></tr>`;
        tableHtml += `<tr><th colspan="7" style="font-size:12px; background:#f3f4f6;">NIT: ${company.nit||''} | Tel: ${company.phone||''} | Dir: ${company.address||''}</th></tr>`;
        tableHtml += `<tr><th colspan="7" style="height:10px;"></th></tr>`;
    }
    tableHtml += `<tr><th colspan="7" style="font-size:16px; text-align:center; background:#4f46e5; color:white;">BÓVEDA - REPORTE DE VENTAS ARCHIVADO</th></tr>`;
    tableHtml += `<tr><td colspan="7"><b>Fecha de Guardado:</b> ${new Date(rep.savedAt).toLocaleString('es-CO', { hour12: true })} | <b>Rango Cubierto:</b> ${rep.dateRangeStr}</td></tr>`;
    tableHtml += `<tr><th style="background:#1e293b; color:white;">ID VENTA</th><th style="background:#1e293b; color:white;">FECHA / HORA</th><th style="background:#1e293b; color:white;">CLIENTE</th><th style="background:#1e293b; color:white;">MÉTODO PAGO</th><th style="background:#1e293b; color:white;">CANT. ARTÍCULOS</th><th style="background:#1e293b; color:white;">T. FACTURADO</th><th style="background:#1e293b; color:white;">G. NETA</th></tr>`;
    
    let tSales = 0, tProfit = 0, tItems = 0;

    rep.itemsDump.forEach(s => {
        const dateStr = new Date(s.date).toLocaleString('es-CO', { hour12: true });
        
        let saleItemsCount = 0;
        let saleTotal = 0;
        let saleProfit = 0;

        s.items.forEach(item => {
            const qty = item.qty || 1;
            saleItemsCount += qty;
            saleTotal += (item.salePrice || 0) * qty;
            saleProfit += ((item.salePrice || 0) - (item.purchasePrice || 0)) * qty;
        });

        tSales += saleTotal;
        tProfit += saleProfit;
        tItems += saleItemsCount;

        tableHtml += `<tr>
            <td style="text-align:center;">#${s.id}</td>
            <td>${dateStr}</td>
            <td>${s.customerName || 'Consumidor Final'}</td>
            <td style="text-align:center;">${s.paymentMethod || 'No especificado'}</td>
            <td style="text-align:center;">${saleItemsCount}</td>
            <td style="text-align:right;">$${saleTotal.toLocaleString()}</td>
            <td style="text-align:right;">$${saleProfit.toLocaleString()}</td>
        </tr>`;
    });

    tableHtml += `<tr style="background:#f1f5f9; font-weight:bold;">
        <td colspan="4" style="text-align:right;">TOTALES VALIDADOS EN ESTE ARCHIVO:</td>
        <td style="text-align:center;">${tItems}</td>
        <td style="text-align:right;">$${tSales.toLocaleString()}</td>
        <td style="text-align:right;">$${tProfit.toLocaleString()}</td>
    </tr></table>`;

    exportToExcelBlob(tableHtml, `reporte_boveda_pedidos_${id}.xls`);
};

window.deleteSavedReport = async (id) => {
    if (!confirm('⚠️ ¿Estás COMPLETAMENTE SEGURO de eliminar este reporte congelado de la bóveda? (Esto NO afecta tus ventas originales).')) return;
    if (!confirm('❗ SEGUNDA CONFIRMACIÓN: Se perderá este registro histórico permanentemente. ¿Proceder?')) return;

    try {
        const res = await fetch(`/api/data/reports.json/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            alert('🚀 Reporte eliminado de la bóveda.');
            window.reportsData = window.reportsData.filter(r => r.id != id);
            renderReports();
        } else {
            alert('Error: ' + (result.error || 'No se pudo eliminar el reporte'));
        }
    } catch (e) {
        console.error(e);
        alert('Error al conectar con el servidor.');
    }
};

// --- FASE 43: SISTEMA DE TEMAS PREMIUM ---
const THEMES = {
    default: {
        name: "Galáctico (Original)",
        colors: {
            '--primary': '#3b82f6',
            '--primary-gradient': 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
            '--primary-glow': 'rgba(59, 130, 246, 0.5)',
            '--secondary': '#06b6d4',
            '--hero-title-grad': 'linear-gradient(to right, #ffffff, #38bdf8, #ffffff)',
            '--hero-sub-color': '#ffffff',
            '--hero-sub-bg': 'rgba(56, 189, 248, 0.15)',
            '--hero-sub-border': 'rgba(56, 189, 248, 0.3)'
        }
    },
    emerald: {
        name: "Esmeralda",
        colors: {
            '--primary': '#10b981',
            '--primary-gradient': 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
            '--primary-glow': 'rgba(16, 185, 129, 0.5)',
            '--secondary': '#34d399',
            '--hero-title-grad': 'linear-gradient(to right, #ffffff, #10b981, #ffffff)',
            '--hero-sub-color': '#ffffff',
            '--hero-sub-bg': 'rgba(16, 185, 129, 0.15)',
            '--hero-sub-border': 'rgba(16, 185, 129, 0.3)'
        }
    },
    ruby: {
        name: "Rubí",
        colors: {
            '--primary': '#ef4444',
            '--primary-gradient': 'linear-gradient(135deg, #ef4444 0%, #f43f5e 100%)',
            '--primary-glow': 'rgba(239, 68, 68, 0.5)',
            '--secondary': '#f43f5e',
            '--hero-title-grad': 'linear-gradient(to right, #ffffff, #ef4444, #ffffff)',
            '--hero-sub-color': '#ffffff',
            '--hero-sub-bg': 'rgba(239, 68, 68, 0.15)',
            '--hero-sub-border': 'rgba(239, 68, 68, 0.3)'
        }
    },
    amber: {
        name: "Ámbar",
        colors: {
            '--primary': '#f59e0b',
            '--primary-gradient': 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
            '--primary-glow': 'rgba(245, 158, 11, 0.5)',
            '--secondary': '#fbbf24',
            '--hero-title-grad': 'linear-gradient(to right, #ffffff, #f59e0b, #ffffff)',
            '--hero-sub-color': '#ffffff',
            '--hero-sub-bg': 'rgba(245, 158, 11, 0.15)',
            '--hero-sub-border': 'rgba(245, 158, 11, 0.3)'
        }
    },
    amethyst: {
        name: "Amatista",
        colors: {
            '--primary': '#8b5cf6',
            '--primary-gradient': 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
            '--primary-glow': 'rgba(139, 92, 246, 0.5)',
            '--secondary': '#a78bfa',
            '--hero-title-grad': 'linear-gradient(to right, #ffffff, #8b5cf6, #ffffff)',
            '--hero-sub-color': '#ffffff',
            '--hero-sub-bg': 'rgba(139, 92, 246, 0.15)',
            '--hero-sub-border': 'rgba(139, 92, 246, 0.3)'
        }
    },
    arctic: {
        name: "Ártico",
        colors: {
            '--primary': '#06b6d4',
            '--primary-gradient': 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 100%)',
            '--primary-glow': 'rgba(6, 182, 212, 0.5)',
            '--secondary': '#22d3ee',
            '--hero-title-grad': 'linear-gradient(to right, #ffffff, #06b6d4, #ffffff)',
            '--hero-sub-color': '#ffffff',
            '--hero-sub-bg': 'rgba(6, 182, 212, 0.15)',
            '--hero-sub-border': 'rgba(6, 182, 212, 0.3)'
        }
    },
    midnight: {
        name: "Medianoche",
        colors: {
            '--primary': '#64748b',
            '--primary-gradient': 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
            '--primary-glow': 'rgba(100, 116, 139, 0.5)',
            '--secondary': '#94a3b8',
            '--hero-title-grad': 'linear-gradient(to right, #ffffff, #64748b, #ffffff)',
            '--hero-sub-color': '#ffffff',
            '--hero-sub-bg': 'rgba(100, 116, 139, 0.15)',
            '--hero-sub-border': 'rgba(100, 116, 139, 0.3)'
        }
    },
    jungle: {
        name: "Selva",
        colors: {
            '--primary': '#65a30d',
            '--primary-gradient': 'linear-gradient(135deg, #65a30d 0%, #84cc16 100%)',
            '--primary-glow': 'rgba(101, 163, 13, 0.5)',
            '--secondary': '#84cc16',
            '--hero-title-grad': 'linear-gradient(to right, #ffffff, #65a30d, #ffffff)',
            '--hero-sub-color': '#ffffff',
            '--hero-sub-bg': 'rgba(101, 163, 13, 0.15)',
            '--hero-sub-border': 'rgba(101, 163, 13, 0.3)'
        }
    },
    sunset: {
        name: "Atardecer",
        colors: {
            '--primary': '#f97316',
            '--primary-gradient': 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
            '--primary-glow': 'rgba(249, 115, 22, 0.5)',
            '--secondary': '#fb923c',
            '--hero-title-grad': 'linear-gradient(to right, #ffffff, #f97316, #ffffff)',
            '--hero-sub-color': '#ffffff',
            '--hero-sub-bg': 'rgba(249, 115, 22, 0.15)',
            '--hero-sub-border': 'rgba(249, 115, 22, 0.3)'
        }
    }
};

async function applyTheme(themeKey) {
    const theme = THEMES[themeKey];
    if (!theme) return;
    
    const root = document.documentElement;
    Object.keys(theme.colors).forEach(key => {
        root.style.setProperty(key, theme.colors[key]);
    });
    
    // RESPALDO LOCAL (Inmediato)
    localStorage.setItem('app-theme-key', themeKey);
    localStorage.setItem('app-theme-data', JSON.stringify(theme.colors));
    
    // FASE 74 FIX: Guardar en MongoDB via API (compatibilidad nube y móvil)
    if (!window.config) window.config = config;
    
    window.config.theme = {
        key: themeKey,
        data: theme.colors
    };
    
    try {
        // Intentar API primero (servidor Render / MongoDB)
        const response = await fetch('/api/data/config.json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(window.config)
        });
        if (response.ok) {
            console.log('Tema sincronizado en MongoDB:', themeKey);
        } else {
            throw new Error('API no disponible');
        }
    } catch(apiError) {
        // Fallback: intentar Electron si está disponible
        try {
            if (window.electronAPI && window.electronAPI.writeData) {
                await window.electronAPI.writeData('config.json', window.config);
                console.log('Tema sincronizado en archivo local:', themeKey);
            }
        } catch(e) {
            console.warn('No se pudo guardar tema en el servidor ni localmente', e);
        }
    }
}

function renderThemeSelector() {
    const grid = document.getElementById('theme-selector-grid');
    if (!grid) return;
    
    const currentTheme = config.theme?.key || 'default';
    
    grid.innerHTML = Object.keys(THEMES).map(key => {
        const t = THEMES[key];
        const isActive = currentTheme === key;
        return `
            <div onclick="applyTheme('${key}'); renderThemeSelector();" class="glass-card-premium" style="cursor: pointer; padding: 10px; text-align: center; border-color: ${isActive ? 'var(--primary)' : 'var(--glass-border)'}; ${isActive ? 'background: rgba(59,130,246,0.1);' : ''} transition: all 0.3s ease;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${t.colors['--primary-gradient']}; margin: 0 auto 10px; border: 2px solid white; box-shadow: 0 0 10px ${t.colors['--primary-glow']};"></div>
                <span style="font-size: 0.75rem; font-weight: 700; color: ${isActive ? 'var(--primary-light)' : 'white'};">${t.name}</span>
            </div>
        `;
    }).join('');
}

document.getElementById('save-theme-global-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('save-theme-global-btn');
    const originalContent = btn.innerHTML;
    
    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        btn.disabled = true;
        
        if (!window.config) window.config = config;
        
        // Asegurar tema actual en el config
        const currentThemeKey = localStorage.getItem('app-theme-key') || 'default';
        const currentThemeData = JSON.parse(localStorage.getItem('app-theme-data') || 'null');
        
        window.config.theme = {
            key: currentThemeKey,
            data: currentThemeData || (THEMES[currentThemeKey] ? THEMES[currentThemeKey].colors : {})
        };

        // FASE 74 FIX: Guardar en MongoDB via API primero
        let saved = false;
        try {
            const response = await fetch('/api/data/config.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(window.config)
            });
            if (response.ok) {
                saved = true;
                console.log('Tema global guardado en MongoDB');
            }
        } catch(apiError) {
            console.warn('API no disponible, intentando Electron...');
        }
        
        // Fallback a Electron si API falló
        if (!saved && window.electronAPI && window.electronAPI.writeData) {
            await window.electronAPI.writeData('config.json', window.config);
            saved = true;
        }
        
        if (saved) {
            btn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            btn.innerHTML = '<i class="fas fa-check-circle"></i> ¡SINCRONIZADO CON ÉXITO!';
            alert("✅ TEMA SINCRONIZADO: El nuevo diseño ya está disponible para tu teléfono y otros dispositivos.");
        } else {
            throw new Error('No se pudo guardar en ningún destino');
        }
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.disabled = false;
            btn.style.background = '';
        }, 3000);

    } catch (error) {
        console.error("Error al guardar tema global:", error);
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ERROR AL GUARDAR';
        btn.style.background = '#ef4444';
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.disabled = false;
            btn.style.background = '';
        }, 3000);
    }
});

document.getElementById('reset-theme-btn')?.addEventListener('click', () => {
    localStorage.removeItem('app-theme-key');
    localStorage.removeItem('app-theme-data');
    location.reload();
});

// --- FASE 8: AJUSTES DE SISTEMA (EMPRESA Y PAGOS) ---
function renderSystemSettings() {
    // Renderizar Selector de Temas
    renderThemeSelector();
    
    // 1. Cargar Datos de Empresa
    const comp = config.company || {};
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.value = val || '';
    };
    
    setVal('setting-company-name', comp.name);
    setVal('setting-company-nit', comp.nit);
    setVal('setting-company-phone', comp.phone);
    setVal('setting-company-address', comp.address);
    setVal('setting-company-appname', comp.appName);
    setVal('setting-company-herotitle', comp.heroTitle);
    setVal('setting-company-herosub', comp.heroSub);

    // 2. Renderizar Lista de Pagos
    const list = document.getElementById('payment-methods-list');
    if(!list) return;
    
    if(!config.payments || config.payments.length === 0) {
        list.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 10px;">No has configurado métodos de pago.</p>';
    } else {
        list.innerHTML = config.payments.map((p, i) => `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); padding: 12px 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fas ${p.qr ? 'fa-qrcode' : 'fa-money-bill-wave'}" style="color: ${p.qr ? 'var(--primary)' : 'var(--success)'}; font-size: 1.2rem;"></i>
                    <span style="font-weight: 700; color: var(--text-main); font-size: 1rem;">${p.name}</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="setupQRUpload(${i})" class="btn-premium-s" title="Asignar/Cambiar QR" style="padding: 8px 12px;"><i class="fas fa-camera"></i></button>
                    <button onclick="removePaymentMethod(${i})" class="btn-premium-d" title="Eliminar" style="padding: 8px 12px;"><i class="fas fa-trash-alt"></i></button>
                </div>
            </div>
        `).join('');
    }
}

document.getElementById('save-company-settings')?.addEventListener('click', async () => {
    config.company = {
        name: document.getElementById('setting-company-name').value.trim(),
        nit: document.getElementById('setting-company-nit').value.trim(),
        phone: document.getElementById('setting-company-phone').value.trim(),
        address: document.getElementById('setting-company-address').value.trim(),
        appName: document.getElementById('setting-company-appname').value.trim(),
        heroTitle: document.getElementById('setting-company-herotitle').value.trim(),
        heroSub: document.getElementById('setting-company-herosub').value.trim()
    };
    await saveConfig();
    alert('✅ Datos de empresa actualizados con éxito.');
});

document.getElementById('add-payment-btn')?.addEventListener('click', async () => {
    const input = document.getElementById('new-payment-name');
    const name = input.value.trim();
    if(!name) return;
    
    if(!config.payments) config.payments = [];
    config.payments.push({ name: name, qr: null });
    input.value = '';
    await saveConfig();
    renderSystemSettings();
});

window.removePaymentMethod = async (index) => {
    if(!confirm('¿Eliminar este método de pago?')) return;
    config.payments.splice(index, 1);
    await saveConfig();
    renderSystemSettings();
    document.getElementById('qr-upload-section').style.display = 'none';
};

let currentQRIndex = null;
window.setupQRUpload = (index) => {
    currentQRIndex = index;
    const payment = config.payments[index];
    const section = document.getElementById('qr-upload-section');
    const preview = document.getElementById('qr-preview-img');
    const nameLabel = document.getElementById('qr-target-name');
    
    section.style.display = 'block';
    nameLabel.textContent = payment.name;
    
    if(payment.qr) {
        preview.src = payment.qr;
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
};

document.getElementById('payment-qr-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file || currentQRIndex === null) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
        const base64 = event.target.result;
        config.payments[currentQRIndex].qr = base64;
        
        document.getElementById('qr-preview-img').src = base64;
        document.getElementById('qr-preview-img').style.display = 'block';
        document.getElementById('qr-status-msg').textContent = 'Subiendo...';
        
        await saveConfig();
        document.getElementById('qr-status-msg').textContent = '✅ QR Guardado';
        renderSystemSettings();
    };
    reader.readAsDataURL(file);
});

// ==== FASE 22: AUDITORÍA DE STOCK REDISEÑADA (INGRESOS/EGRESOS) ====
window.renderStockAuditTree = () => {
    const containerIn = document.getElementById('stock-audit-tree-in');
    const containerOut = document.getElementById('stock-audit-tree-out');
    const searchInput = document.getElementById('audit-search-input');
    if (!containerIn || !containerOut) return;

    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    // 1. Agrupar datos
    const tree = {};
    products.forEach(p => {
        const cat = p.category || 'Sin Categoría';
        const sub = p.subCategory || 'Sin Subcategoría';
        const matches = p.name.toLowerCase().includes(searchTerm) || (p.ref && p.ref.toLowerCase().includes(searchTerm));
        if (searchTerm && !matches) return;

        if (!tree[cat]) tree[cat] = {};
        if (!tree[cat][sub]) tree[cat][sub] = [];
        tree[cat][sub].push(p);
    });

    const createTreeHTML = (mode) => {
        if (Object.keys(tree).length === 0) return `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.8rem;">No hay coincidencias.</div>`;
        
        let html = '';
        const isIngreso = mode === 'IN';

        for (const cat in tree) {
            let catStock = 0;
            let subHtml = '';

            for (const sub in tree[cat]) {
                let subStock = 0;
                let prodHtml = '';

                tree[cat][sub].forEach(p => {
                    let pStock = 0;
                    let variantHtml = '';
                    
                    if (p.sizes && p.sizes.length > 0) {
                        p.sizes.forEach((sz, idx) => {
                            const s = sz.stock || 0;
                            pStock += s;
                            variantHtml += `
                                <div class="audit-variant-chip ${s <= 5 ? 'stock-low' : 'stock-ok'}" style="display:flex; flex-direction:column; align-items:center; gap:5px;">
                                    <div style="font-weight:700;">${sz.size} <span style="font-weight:400; opacity:0.7;">(${sz.color})</span></div>
                                    <div style="font-size:1.1rem; font-weight:800; color:white;">${s}</div>
                                    <div style="display:flex; gap:5px; width:100%; align-items:center;">
                                        <button onclick="const val = parseInt(document.getElementById('adj-${isIngreso ? 'in' : 'out'}-${p.id}-${idx}').value) || 0; window.updateStockAudit('${p.id}', ${idx}, ${isIngreso ? '' : '-'}val)" 
                                                style="flex:1; padding:8px 5px; border-radius:6px; border:none; background:${isIngreso ? '#10b981' : '#ef4444'}; color:white; cursor:pointer; font-size:0.9rem;">
                                            <i class="fas fa-check"></i>
                                        </button>
                                        <input type="number" id="adj-${isIngreso ? 'in' : 'out'}-${p.id}-${idx}" value="1" 
                                               style="width: 45px; text-align: center; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: white; border-radius: 4px; font-weight: 700; font-size: 0.85rem; padding: 5px 2px;">
                                    </div>
                                </div>
                            `;
                        });
                    }

                    subStock += pStock;
                    prodHtml += `
                        <div class="audit-product" style="border-left: 3px solid ${isIngreso ? '#10b981' : '#ef4444'}; margin-bottom:15px; background:rgba(255,255,255,0.01);">
                            <div style="margin-bottom:10px;">
                                <strong style="color:white; font-size:0.9rem;">${p.name}</strong>
                                <span style="color:var(--primary); font-size:0.7rem; margin-left:10px;">REF: ${p.ref || 'S/R'}</span>
                            </div>
                            <div class="audit-product-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap:8px;">
                                ${variantHtml}
                            </div>
                        </div>
                    `;
                });

                catStock += subStock;
                subHtml += `
                    <div class="audit-subnode">
                        <div class="audit-subnode-header" onclick="this.parentElement.classList.toggle('open')" style="background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:8px; margin-bottom:5px;">
                            <i class="fas fa-chevron-right" style="font-size:0.7rem;"></i>
                            <span style="font-size:0.8rem;">${sub.toUpperCase()}</span>
                            <span style="margin-left:auto; font-size:0.7rem; opacity:0.6;">Total Sub: ${subStock}</span>
                        </div>
                        <div class="audit-subnode-content" style="padding-left:10px;">${prodHtml}</div>
                    </div>
                `;
            }

            html += `
                <div class="audit-node ${searchTerm ? 'open' : ''}">
                    <div class="audit-node-header" onclick="this.parentElement.classList.toggle('open')" style="border-radius:12px; margin-bottom:10px;">
                        <div class="audit-node-title" style="font-size:0.85rem;">
                            <i class="fas fa-folder" style="color:#f59e0b;"></i>
                            <span>${cat}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:0.75rem; background:rgba(255,255,255,0.05); padding:2px 8px; border-radius:20px;">${catStock} Unid.</span>
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                    <div class="audit-node-content" style="padding: 0 0 10px 15px; border-left: 1px dashed rgba(255,255,255,0.1); margin-left:10px;">${subHtml}</div>
                </div>
            `;
        }
        return html;
    };

    containerIn.innerHTML = createTreeHTML('IN');
    containerOut.innerHTML = createTreeHTML('OUT');
};

window.updateStockAudit = async (productId, variantIndex, delta) => {
    const pIndex = products.findIndex(p => p.id == productId);
    if (pIndex === -1) return;

    const currentStock = products[pIndex].sizes[variantIndex].stock || 0;
    const newStock = Math.max(0, currentStock + delta);
    
    products[pIndex].sizes[variantIndex].stock = newStock;
    
    // Guardar cambios
    await window.electronAPI.writeData('products.json', products);
    
    // Refrescar vistas
    renderStockAuditTree();
    renderAdminProducts(); // Sincronizar vista principal
};

// Vinculación del buscador
document.getElementById('audit-search-input')?.addEventListener('input', () => {
    clearTimeout(window.auditSearchTimer);
    window.auditSearchTimer = setTimeout(renderStockAuditTree, 300);
});

// ---- GESTIÓN DE USUARIOS (FASE 35) ----
window.renderUsers = async function() {
    console.log("Iniciando renderUsers...");
    const list = document.getElementById('admin-user-list');
    if (!list) {
        console.error("No se encontró el elemento admin-user-list");
        return;
    }

    try {
        const users = await window.electronAPI.readData('users.json') || [];
        const session = await window.electronAPI.readData('session.json');
        const currentUser = session?.currentUser?.username;
        
        console.log("Usuarios cargados:", users.length);

        if (users.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">No hay usuarios registrados.</td></tr>';
            return;
        }

        list.innerHTML = users.map(u => `
            <tr>
                <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:35px; height:35px; border-radius:50%; background:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:bold; color:white;">
                            ${(u.username || 'U').charAt(0).toUpperCase()}
                        </div>
                        <strong>${u.username || 'S/N'}</strong>
                    </div>
                </td>
                <td>${u.name || u.fullname || 'Consumidor Final'}</td>
                <td>
                    <span class="chip-premium" style="background: ${u.role === 'admin' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.05)'}; color: ${u.role === 'admin' ? '#a855f7' : 'var(--text-muted)'}; border: 1px solid ${u.role === 'admin' ? '#a855f7' : 'var(--glass-border)'};">
                        <i class="fas ${u.role === 'admin' ? 'fa-user-shield' : 'fa-user'}"></i> ${u.role === 'admin' ? 'Administrador' : 'Usuario'}
                    </span>
                </td>
                <td>${u.phone || 'N/A'}</td>
                <td style="font-size: 0.8rem;">${u.city ? `${u.city}, ${u.department || ''}` : 'N/A'}</td>
                <td style="text-align:center;">
                    <div class="admin-actions" style="justify-content: center; gap: 10px;">
                        <button class="btn-premium-s" style="padding: 8px 12px;" title="Editar Perfil" onclick="openEditUserModal('${u.username}')">
                            <i class="fas fa-user-edit"></i>
                        </button>
                        ${u.username !== 'admin' && u.username !== currentUser ? `
                            <button class="btn-premium-d" style="padding: 8px 12px;" title="Eliminar" onclick="deleteUser('${u.username}')">
                                <i class="fas fa-user-slash"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Error en renderUsers:", err);
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error al cargar datos de usuarios.</td></tr>';
    }
};

// --- SISTEMA DE EDICIÓN DE USUARIOS PREMIUM (FASE 39) ---
const userEditModal = document.getElementById('user-edit-modal');
const userEditForm = document.getElementById('user-edit-form');

window.openEditUserModal = async (username) => {
    try {
        const users = await window.electronAPI.readData('users.json') || [];
        const userList = users.map(u => u.username).join(', ');
        
        const user = users.find(u => String(u.username).trim() === String(username).trim());
        
        if (!user) {
            return;
        }

        // Llenar campos con datos existentes
        document.getElementById('edit-user-username').value = user.username;
        document.getElementById('edit-user-fullname').value = user.fullname || user.name || '';
        document.getElementById('edit-user-nit').value = user.nit || '';
        document.getElementById('edit-user-role').value = user.role || 'user';
        document.getElementById('edit-user-phone').value = user.phone || '';
        document.getElementById('edit-user-dept').value = user.department || '';
        document.getElementById('edit-user-city').value = user.city || '';
        document.getElementById('edit-user-address').value = user.address || '';
        document.getElementById('edit-user-pass').value = ''; // Password siempre vacío por seguridad

        // Protección especial para Admin Maestro
        const roleSelect = document.getElementById('edit-user-role');
        if (username === 'admin') {
            roleSelect.disabled = true;
            roleSelect.title = "El rol del Super Administrador no puede ser modificado.";
        } else {
            roleSelect.disabled = false;
            roleSelect.title = "";
        }

        const modal = document.getElementById('user-edit-modal');
        if (modal) modal.classList.add('active');
    } catch (error) {
        console.error('Error al abrir editor:', error);
    }
};

if (userEditForm) {
    userEditForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('edit-user-username').value;
        const newPass = document.getElementById('edit-user-pass').value;

        try {
            let users = await window.electronAPI.readData('users.json') || [];
            const index = users.findIndex(u => String(u.username).trim() === String(username).trim());

            if (index !== -1) {
                // Actualización de campos
                users[index].fullname = document.getElementById('edit-user-fullname').value;
                users[index].name = users[index].fullname; 
                users[index].nit = document.getElementById('edit-user-nit').value;
                
                // Solo cambiar rol si no es el admin principal
                if (username !== 'admin') {
                    users[index].role = document.getElementById('edit-user-role').value;
                }
                
                users[index].phone = document.getElementById('edit-user-phone').value;
                users[index].department = document.getElementById('edit-user-dept').value;
                users[index].city = document.getElementById('edit-user-city').value;
                users[index].address = document.getElementById('edit-user-address').value;

                // Cambio de password opcional
                if (newPass.trim() !== "") {
                    users[index].password = newPass;
                }

                await window.electronAPI.writeData('users.json', users);
                
                // Actualizar la sesión si el usuario editado es el que está logueado actualmente
                const session = await window.electronAPI.readData('session.json');
                if (session && session.currentUser && String(username).trim() === String(session.currentUser.username).trim()) {
                    session.currentUser = { ...session.currentUser, ...users[index] };
                    await window.electronAPI.writeData('session.json', session);
                }

                alert('✅ Cambios guardados correctamente');
                userEditModal.classList.remove('active');
                renderUsers(); // Refrescar la tabla en Ajustes
            }
        } catch (error) {
            alert('❌ Error al guardar datos: ' + error.message);
            console.error(error);
        }
    });
}

// Botones de cierre del modal
if (document.getElementById('close-user-edit-modal')) {
    document.getElementById('close-user-edit-modal').onclick = () => userEditModal.classList.remove('active');
}
if (document.getElementById('cancel-user-edit')) {
    document.getElementById('cancel-user-edit').onclick = () => userEditModal.classList.remove('active');
}
// --- FIN SISTEMA EDICIÓN USUARIOS ---

window.deleteUser = async (username) => {
    if (!confirm(`⚠️ ¿Estás COMPLETAMENTE SEGURO de que deseas eliminar al usuario "${username}"? Esta acción no se puede deshacer.`)) return;
    if (!confirm('❗ SEGUNDA CONFIRMACIÓN: Se perderá todo acceso para este usuario permanentemente. ¿Proceder?')) return;

    try {
        const res = await fetch(`/api/data/users.json/${username}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            alert(`🚀 Usuario "${username}" eliminado exitosamente.`);
            renderUsers(); // Refrescar lista de usuarios
        } else {
            alert('Error: ' + (result.error || 'No se pudo eliminar el usuario'));
        }
    } catch (e) {
        console.error(e);
        alert('Error al conectar con el servidor.');
    }
};
