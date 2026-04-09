const API_URL = (window.location.protocol === 'file:') 
    ? 'http://localhost:3344' 
    : '';

// --- LÓGICA DE TEMA INMEDIATA (Para evitar parpadeo) ---
(function() {
    const Themes = {
        normal: { '--primary': '#6366f1', '--primary-light': '#818cf8', '--primary-glow': 'rgba(99, 102, 241, 0.2)', '--accent': '#38bdf8', '--bg': '#0a0b14', '--card-bg': 'rgba(255, 255, 255, 0.03)', '--header-dark': '#020617' },
        natural: { '--primary': '#64748b', '--primary-light': '#94a3b8', '--primary-glow': 'rgba(100, 116, 139, 0.1)', '--accent': '#94a3b8', '--bg': '#0f172a', '--card-bg': 'rgba(255, 255, 255, 0.02)', '--header-dark': '#020617' },
        vivido: { '--primary': '#2563eb', '--primary-light': '#3b82f6', '--primary-glow': 'rgba(37, 99, 235, 0.4)', '--accent': '#00e0ff', '--bg': '#00040d', '--card-bg': 'rgba(255, 255, 255, 0.05)', '--header-dark': '#000000' },
        cibernetico: { '--primary': '#0084ff', '--primary-light': '#00c3ff', '--primary-glow': 'rgba(0, 132, 255, 0.5)', '--accent': '#00f2ff', '--bg': '#05060f', '--card-bg': 'rgba(0, 132, 255, 0.05)', '--header-dark': '#000814' },
        esmeralda: { '--primary': '#10b981', '--primary-light': '#34d399', '--primary-glow': 'rgba(16, 185, 129, 0.4)', '--accent': '#34d399', '--bg': '#020617', '--card-bg': 'rgba(16, 185, 129, 0.05)', '--header-dark': '#000500' },
        atardecer: { '--primary': '#f59e0b', '--primary-light': '#fbbf24', '--primary-glow': 'rgba(245, 158, 11, 0.4)', '--accent': '#fbbf24', '--bg': '#0c0a09', '--card-bg': 'rgba(245, 158, 11, 0.05)', '--header-dark': '#050000' },
        galaxia: { '--primary': '#8b5cf6', '--primary-light': '#a78bfa', '--primary-glow': 'rgba(139, 92, 246, 0.4)', '--accent': '#a78bfa', '--bg': '#0f0720', '--card-bg': 'rgba(139, 92, 246, 0.05)', '--header-dark': '#050010' },
        rubi: { '--primary': '#ef4444', '--primary-light': '#f87171', '--primary-glow': 'rgba(239, 68, 68, 0.4)', '--accent': '#f87171', '--bg': '#0f0505', '--card-bg': 'rgba(239, 68, 68, 0.05)', '--header-dark': '#100000' },
        predefinido: {} // No aplica variables
    };
    const savedTheme = localStorage.getItem('selected-theme') || 'predefinido';
    if (savedTheme === 'predefinido') return; // Bypass completo

    const theme = Themes[savedTheme] || Themes.normal;
    for (const [key, value] of Object.entries(theme)) {
        document.documentElement.style.setProperty(key, value);
    }
})();

async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        if (!response.ok) {
            const text = await response.text();
            let errorMessage = `Error ${response.status}`;
            try {
                const error = JSON.parse(text);
                errorMessage = error.message || error.error || errorMessage;
            } catch(e) {
                if (response.status === 404) errorMessage = "Ruta no encontrada en el servidor.";
                if (response.status === 500) errorMessage = "Error interno del servidor. Verifique los logs.";
            }
            throw new Error(errorMessage);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        if (error.message.includes('Failed to fetch')) {
            throw new Error("No se pudo conectar con el servidor. Verifique su conexión o si el servidor está activo.");
        }
        throw error;
    }
}

// --- CONFIGURACIÓN GLOBAL DE UNIDADES PARA DIAN/ALEGRA ---
const unitMap = {
    'unidad': 'unit', 'und': 'unit', 'unit': 'unit',
    'piezas': 'piece', 'pieza': 'piece', 'unidad de medida': 'unit',
    'lt': 'liter', 'litro': 'liter', 'litros': 'liter',
    'kg': 'kilogram', 'kilogramo': 'kilogram', 'kilos': 'kilogram',
    'servicio': 'service', 'servicios': 'service',
    'paquete': 'unit', 'caja': 'unit', // Alegra/DIAN suelen preferir 'unit' para cajas si no hay una medida SI específica
    'metro': 'meter', 'm': 'meter'
};

// --- HELPER DE FORMATO DE PRODUCTOS (SOLO PARA UI) ---

// Funciones para usar en los HTML
const API = {
    login: (user, pass) => apiRequest('/api/login', 'POST', { user, pass }),
    register: (data) => apiRequest('/api/register', 'POST', data),
    getProductos: () => apiRequest('/api/productos'),
    getConfig: () => apiRequest('/api/config'),
    saveProducto: (producto) => apiRequest('/api/productos', 'POST', producto),
    deleteProducto: (id) => apiRequest(`/api/productos/${id}`, 'DELETE'),
    getPedidos: () => apiRequest('/api/pedidos'),
    savePedido: (pedido) => apiRequest('/api/pedidos', 'POST', pedido),
    deletePedido: (id, revert = true) => apiRequest(`/api/pedidos/${id}?revert=${revert}`, 'DELETE'),
    deleteAllPedidos: () => apiRequest('/api/delete-all-pedidos', 'POST'),
    saveConfig: (config) => apiRequest('/api/config', 'POST', config),
    getUsuarios: () => apiRequest('/api/usuarios'),
    saveUsuarios: (usuarios) => apiRequest('/api/usuarios', 'POST', usuarios),
    getReportes: () => apiRequest('/api/reportes'),
    saveReportes: (data) => apiRequest('/api/reportes', 'POST', data),
    deleteReporte: (id) => apiRequest(`/api/reportes/${id}`, 'DELETE'),
    getIngresos: () => apiRequest('/api/ingresos'),
    saveIngresos: (data) => apiRequest('/api/ingresos', 'POST', data),
    deleteIngreso: (id) => apiRequest(`/api/ingresos/${id}`, 'DELETE'),
    getEgresos: () => apiRequest('/api/egresos'),
    saveEgresos: (data) => apiRequest('/api/egresos', 'POST', data),
    deleteEgreso: (id) => apiRequest(`/api/egresos/${id}`, 'DELETE'),
    resetSystem: () => apiRequest('/api/reset-system', 'POST'),
    deleteAllProducts: () => apiRequest('/api/delete-all-products', 'POST'),

    restoreColeccion: (id, data) => apiRequest(`/api/restore/${id}`, 'POST', data),
    clearColeccion: (id) => apiRequest(`/api/clear/${id}`, 'DELETE'),

    getFechaLocal: (timestamp = null) => {
        const d = timestamp ? new Date(timestamp) : new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    DEFAULT_IMAGE: 'https://cdn-icons-png.flaticon.com/512/1170/1170679.png',

    // --- HELPER DE FORMATO DE PRODUCTOS (SOLO PARA UI) ---
    formatProductName: (nombre, unidad) => {
        if (!nombre) return "";
        let clean = nombre;
        if (unidad) {
            const u = unidad.trim();
            if (u) {
                // Escapar caracteres especiales para el regex
                const escapedUnit = u.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                // Regex para quitar " (Unidad)", "(Unidad)", " Unidad" al final (case insensitive)
                const regex = new RegExp(`\\s*[\\(\\[]?\\s*${escapedUnit}\\s*[\\)\\]]?\\s*$`, 'i');
                clean = clean.replace(regex, '');
            }
        }
        return clean.trim();
    },


    // --- SISTEMA DE TEMAS ---
    Themes: {
        normal: { '--primary': '#6366f1', '--primary-light': '#818cf8', '--primary-glow': 'rgba(99, 102, 241, 0.2)', '--accent': '#38bdf8', '--bg': '#0a0b14', '--card-bg': 'rgba(255, 255, 255, 0.03)', '--header-dark': '#020617' },
        natural: { '--primary': '#64748b', '--primary-light': '#94a3b8', '--primary-glow': 'rgba(100, 116, 139, 0.1)', '--accent': '#94a3b8', '--bg': '#0f172a', '--card-bg': 'rgba(255, 255, 255, 0.02)', '--header-dark': '#020617' },
        vivido: { '--primary': '#2563eb', '--primary-light': '#3b82f6', '--primary-glow': 'rgba(37, 99, 235, 0.4)', '--accent': '#00e0ff', '--bg': '#00040d', '--card-bg': 'rgba(255, 255, 255, 0.05)', '--header-dark': '#000000' },
        cibernetico: { '--primary': '#0084ff', '--primary-light': '#00c3ff', '--primary-glow': 'rgba(0, 132, 255, 0.5)', '--accent': '#00f2ff', '--bg': '#05060f', '--card-bg': 'rgba(0, 132, 255, 0.05)', '--header-dark': '#000814' },
        esmeralda: { '--primary': '#10b981', '--primary-light': '#34d399', '--primary-glow': 'rgba(16, 185, 129, 0.4)', '--accent': '#34d399', '--bg': '#020617', '--card-bg': 'rgba(16, 185, 129, 0.05)', '--header-dark': '#000500' },
        atardecer: { '--primary': '#f59e0b', '--primary-light': '#fbbf24', '--primary-glow': 'rgba(245, 158, 11, 0.4)', '--accent': '#fbbf24', '--bg': '#0c0a09', '--card-bg': 'rgba(245, 158, 11, 0.05)', '--header-dark': '#050000' },
        galaxia: { '--primary': '#8b5cf6', '--primary-light': '#a78bfa', '--primary-glow': 'rgba(139, 92, 246, 0.4)', '--accent': '#a78bfa', '--bg': '#0f0720', '--card-bg': 'rgba(139, 92, 246, 0.05)', '--header-dark': '#050010' },
        rubi: { '--primary': '#ef4444', '--primary-light': '#f87171', '--primary-glow': 'rgba(239, 68, 68, 0.4)', '--accent': '#f87171', '--bg': '#0f0505', '--card-bg': 'rgba(239, 68, 68, 0.05)', '--header-dark': '#100000' },
        predefinido: {}
    },

    applyTheme: (themeId) => {
        localStorage.setItem('selected-theme', themeId);
        const root = document.documentElement;
        if (themeId === 'predefinido') {
            // Limpiar variables de temas anteriores si existen
            const allVars = ['--primary', '--primary-light', '--primary-glow', '--accent', '--bg', '--card-bg', '--header-dark'];
            allVars.forEach(v => root.style.removeProperty(v));
            console.log("Tema predefinido activo: Variables limpiadas.");
            return;
        }
        const theme = API.Themes[themeId] || API.Themes.normal;
        for (const [key, value] of Object.entries(theme)) {
            root.style.setProperty(key, value);
        }
        console.log(`Tema aplicado y guardado: ${themeId}`);
    },

    // --- UTILIDADES DE FORMATEO Y CÁLCULOS (ENTEROS PUROS) ---
    formatNumber: (val) => {
        const num = Math.round(parseFloat(val) || 0);
        return num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
    },

    calcularIVA: (valor, porcentaje, modo = 'incluido') => {
        const p = parseFloat(porcentaje) || 0;
        const v = parseFloat(valor) || 0;
        let base = 0, iva = 0, total = 0;

        if (modo === 'adicionado') {
            base = v;
            iva = v * (p / 100);
            total = v + iva;
        } else {
            total = v;
            base = v / (1 + (p / 100));
            iva = v - base;
        }

        return {
            base: Math.round(base),
            iva: Math.round(iva),
            total: Math.round(total),
            porcentaje: p,
            modo: modo
        };
    },

    DIAN_PROVIDERS: [
        { id: 'simulacion', name: 'Simulación (Documentos de Muestra)', url: '', fields: [] },
        { id: 'dataico', name: 'Dataico (API REST)', url: 'https://api.dataico.com/v2', fields: ['token', 'account_id'] },
        { id: 'alegra', name: 'Alegra (API REST)', url: 'https://api.alegra.com/api/v1', fields: ['email', 'token'] },
        { id: 'facturatech', name: 'Facturatech (SOAP/REST)', url: 'https://api.facturatech.co', fields: ['user', 'pass'] },
        { id: 'siigo', name: 'Siigo (API REST)', url: 'https://api.siigo.com/v1', fields: ['api_key', 'user'] },
        { id: 'custom', name: 'Personalizado / Otro', url: '', fields: ['token'] }
    ],

    reportarPedidoADian: async (idPedido) => {
        // 1. Obtener el pedido actual
        const pedidos = await API.getPedidos();
        const pIdx = pedidos.findIndex(p => p.id == idPedido);
        if (pIdx === -1) throw new Error("Pedido no encontrado");
        const pedido = pedidos[pIdx];

        // 2. Obtener configuración DIAN
        const config = await API.getConfig();
        const dian = config.empresa || {};
        
        // Si no hay proveedor o es simulación, marcamos como muestra
        const esMuestra = (!dian.dianProveedor || dian.dianProveedor === 'simulacion' || dian.dianProveedor === '');

        // 3. Ejecución del Envío
        let dianResponse;
        
        // --- GENERACIÓN DE PDF LOCAL (SIEMPRE SE GENERA PARA CONTROL VISUAL) ---
        const nroFactura = pedido.id;
        let acumuladoBase = 0;
        let acumuladoIva = 0;
        let htmlItems = pedido.items.map(it => {
            let pPerc = parseFloat(it.iva || 0);
            const sub = Math.round(it.precio * it.cantidad);
            const bItem = Math.round(sub / (1 + (pPerc / 100)));
            const iItem = sub - bItem;
            acumuladoBase += bItem;
            acumuladoIva += iItem;

            return `<tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${it.nombre}</td>
                <td align="right" style="padding: 8px; border-bottom: 1px solid #eee;">$${API.formatNumber(bItem)}</td>
                <td align="right" style="padding: 8px; border-bottom: 1px solid #eee;">$${API.formatNumber(iItem)}</td>
                <td align="center" style="padding: 8px; border-bottom: 1px solid #eee;">${pPerc}%</td>
                <td align="right" style="padding: 8px; border-bottom: 1px solid #eee;"><strong>$${API.formatNumber(sub)}</strong></td>
            </tr>`;
        }).join('');

        const localPdfHtml = `
            <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
            <body style="font-family:sans-serif; padding:20px; color:#333; background:#f4f4f4;">
                <div style="background:white; border:1px solid #ccc; padding:30px; max-width:850px; margin:auto; position:relative; overflow:hidden; min-height:1000px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
                    <div style="position:absolute; top:30%; left:50%; transform:translate(-50%, -50%) rotate(-45deg); font-size:120px; color:rgba(0,0,0,0.05); font-weight:bold; white-space:nowrap; pointer-events:none; z-index:0;">BORRADOR</div>
                    
                    <div style="position:relative; z-index:1;">
                        <table style="width:100%; margin-bottom:20px;">
                            <tr>
                                <td width="50%">
                                    ${dian.logoBase64 ? `<img src="${dian.logoBase64}" style="max-height:100px; margin-bottom:10px;">` : `<div style="font-size:24px; font-weight:bold; color:#6366f1;">${dian.nombre || 'MI EMPRESA'}</div>`}
                                    <div style="font-size:12px; color:#666;">
                                        <strong>${dian.nombre || ''}</strong><br>
                                        NIT: ${dian.nit || ''}<br>
                                        ${dian.direccion || ''}<br>
                                        ${dian.municipio || ''}, ${dian.departamento || ''}<br>
                                        Tel: ${dian.telefono || ''}
                                    </div>
                                </td>
                                <td align="right" valign="top">
                                    <div style="font-size:14px; color:#666;">Factura de venta de papel</div>
                                    <div style="font-size:32px; font-weight:bold; color:#000;">${nroFactura}</div>
                                    <div style="font-size:12px; margin-top:10px;">
                                        <strong>Fecha:</strong> ${pedido.fecha || new Date().toLocaleDateString()}<br>
                                        <strong>Hora:</strong> ${pedido.hora || new Date().toLocaleTimeString()}
                                    </div>
                                </td>
                            </tr>
                        </table>

                        <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:20px; font-size:13px;">
                            <strong>Cliente:</strong> Consumidor Final (222222222222)<br>
                            <strong>Moneda:</strong> COP | <strong>Bodega:</strong> Principal
                        </div>

                        <table border="0" style="width:100%; border-collapse:collapse; font-size:12px;">
                            <tr style="background:#eee;">
                                <th align="left" style="padding: 10px;">ITEM</th>
                                <th align="right" style="padding: 10px;">Base</th>
                                <th align="right" style="padding: 10px;">Impuesto</th>
                                <th align="center" style="padding: 10px;">IVA</th>
                                <th align="right" style="padding: 10px;">Subtotal</th>
                            </tr>
                            ${htmlItems}
                        </table>

                        <div style="margin-top:30px; text-align:right; border-top:2px solid #333; padding-top:15px;">
                            <div style="margin-bottom:8px; color:#666;">SUBTOTAL (Base): $${API.formatNumber(acumuladoBase)}</div>
                            <div style="margin-bottom:8px; color:#666;">IVA TOTAL: $${API.formatNumber(acumuladoIva)}</div>
                            <div style="font-size:20px; font-weight:bold;">TOTAL FACTURA: $${API.formatNumber(pedido.total)}</div>
                        </div>

                        <div style="margin-top:50px; font-size:11px; color:#666; border-top:1px solid #eee; padding-top:10px;">
                            <p><strong>Notas:</strong> Este documento es una representación gráfica simplificada. La validez fiscal está respaldada por el reporte electrónico enviado al proveedor tecnológico.</p>
                            <p style="text-align:center; margin-top:20px; opacity:0.5;">Generado por SISCONTED v2.0</p>
                        </div>
                    </div>
                </div>
            </body></html>`;
        
        const localBlob = new Blob([localPdfHtml], { type: 'text/html;charset=UTF-8' });
        const localPdfUrl = URL.createObjectURL(localBlob);

        if (esMuestra) {
            // --- MODO SIMULACIÓN ---
            await new Promise(r => setTimeout(r, 1000));
            dianResponse = {
                success: true,
                nroFactura: nroFactura,
                pdfUrl: localPdfUrl,
                isSample: true,
                proveedor: 'simulacion'
            };
        } else if (dian.dianProveedor === 'alegra') {
            // --- MODO ALEGRA ---
            const email = dian.dianCampos.email;
            const token = dian.dianCampos.token;
            if(!email || !token) throw new Error("Faltan credenciales de Alegra (Email/Token)");
            const auth = btoa(`${email}:${token}`);
            
            // --- IDEMPOTENCIA: Si ya tiene ID de Alegra, intentamos recuperar datos en lugar de duplicar ---
            if (pedido.dian && pedido.dian.idAlegra) {
                try {
                    const resGet = await fetch(`https://api.alegra.com/api/v1/invoices/${pedido.dian.idAlegra}`, {
                        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
                    });
                    if (resGet.ok) {
                        const data = await resGet.json();
                        dianResponse = {
                            success: true,
                            idAlegra: data.id,
                            cufe: data.cufe || pedido.dian.cufe || 'POR-PROCESAR',
                            nroFactura: data.numberFull,
                            pdfUrl: data.pdfUrl || data.publicUrl || `https://app.alegra.com/invoice/view/id/${data.id}?format=pdf`,
                            xmlUrl: data.xmlUrl || '',
                            fechaReporte: pedido.dian.fechaReporte || new Date().toLocaleString(),
                            isSample: false,
                            proveedor: 'alegra'
                        };
                        pedido.dian = dianResponse;
                        await API.savePedido(pedido);
                        return dianResponse;
                    }
                } catch (e) {
                    console.warn("No se pudo recuperar la factura existente:", e);
                }
            }

            // 1. Obtener IDs de Alegra para cada ítem (Buscar o Crear)
            const processedItems = [];
            // Idempotencia: si ya tiene idAlegra, no volver a reportar pero devolver datos
            if (pedido.dian && pedido.dian.idAlegra) {
                return pedido.dian;
            }

            const taxes = await API._getAlegraTaxes(auth);
            const findTaxId = (perc) => {
                const t = taxes.find(x => Math.abs(parseFloat(x.percentage) - perc) < 0.1);
                return t ? t.id : (perc === 0 ? 2 : 1); // Fallback si no encuentra
            };

            for (const it of pedido.items) {
                const pPerc = parseFloat(it.iva || 0);
                const taxId = findTaxId(pPerc);
                const alegraId = await API._getAlegraItemId(it, auth, taxId);
                const unitNeto = it.precio / (1 + (pPerc / 100));
                
                console.log(`[DIAN] Procesando item: ${it.nombre} | Unidad: ${it.unidad}`);

                // --- Lógica de Visualización de Unidades Mejorada ---
                const rawUnit = it.unidad ? it.unidad.trim() : '';
                const baseUnit = rawUnit.toLowerCase();
                const technicalUnit = unitMap[baseUnit] || 'unit';
                const displayName = it.nombre;

                const itemPayload = {
                    id: alegraId,
                    name: displayName, 
                    description: `Unidad: ${rawUnit || 'Und'} | Ref: ${it.referencia || '---'}`,
                    price: unitNeto,
                    total: it.precio * it.cantidad,
                    quantity: it.cantidad,
                    unit: technicalUnit,
                    tax: [{ id: taxId }]
                };
                
                console.log(`[DIAN] Payload para Alegra:`, itemPayload);
                processedItems.push(itemPayload);
            }

            const payload = {
                date: new Date().toISOString().split('T')[0],
                dueDate: new Date().toISOString().split('T')[0],
                client: { id: config.empresa?.dianCampos?.client_id || 1 }, 
                items: processedItems,
                paymentForm: 'CASH',
                paymentMethod: 'CASH',
                status: 'open', // Obligatorio para generar PDF
                stamp: { generateStamp: true } // Sello electrónico (DIAN)
            };

            console.log("Enviando factura a Alegra:", JSON.stringify(payload, null, 2));

            const headers = {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            let response = await fetch('https://api.alegra.com/api/v1/invoices', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            // Si falla el timbrado, intentar sin stamp
            if (!response.ok) {
                try {
                    const errClone = await response.clone().json();
                    if (JSON.stringify(errClone).toLowerCase().includes('stamp')) {
                        console.log("Fallo de sello. Reintentando sin stamp...");
                        delete payload.stamp;
                        response = await fetch('https://api.alegra.com/api/v1/invoices', {
                            method: 'POST',
                            headers: headers,
                            body: JSON.stringify(payload)
                        });
                    }
                } catch(e) {}
            }

            // Nivel 2: Si falla el timbrado o el modo Open, intentar buscar una resolución disponible
            if (!response.ok) {
                try {
                    const errClone2 = await response.clone().json();
                    if (JSON.stringify(errClone2).toLowerCase().includes('number') || JSON.stringify(errClone2).toLowerCase().includes('resolution') || JSON.stringify(errClone2).toLowerCase().includes('open')) {
                        console.log("Detectado problema de resolución. Buscando numeraciones disponibles...");
                        const resTemplates = await fetch('https://api.alegra.com/api/v1/number-templates', {
                            headers: headers
                        });
                        if (resTemplates.ok) {
                            const templates = await resTemplates.json();
                            if (templates.length > 0) {
                                console.log("Usando numeración encontrada:", templates[0].id);
                                payload.numberTemplate = { id: templates[0].id };
                                payload.status = 'open';
                                delete payload.stamp;
                                response = await fetch('https://api.alegra.com/api/v1/invoices', {
                                    method: 'POST',
                                    headers: headers,
                                    body: JSON.stringify(payload)
                                });
                            }
                        }
                    }
                } catch(e) {
                    console.error("Error al buscar resoluciones:", e);
                }
            }

            // Nivel 3: Último recurso, guardar como Draft
            if (!response.ok) {
                try {
                    console.log("Fallo final modo Open. Guardando como Draft...");
                    payload.status = 'draft';
                    delete payload.stamp;
                    delete payload.numberTemplate;
                    response = await fetch('https://api.alegra.com/api/v1/invoices', {
                        method: 'POST',
                        headers: headers,
                        body: JSON.stringify(payload)
                    });
                } catch(e) {}
            }

            if (!response.ok) {
                let errorMsg = "Error desconocido";
                try {
                    const errData = await response.json();
                    console.error("Detalle Error Alegra:", errData);
                    errorMsg = errData.message || (errData.errors && errData.errors[0]?.message) || response.statusText;
                } catch(e) {
                    errorMsg = response.statusText;
                }
                throw new Error("Alegra API: " + errorMsg);
            }

            let data = await response.json();

            // Sincronización rápida si faltan datos en la respuesta del POST
            if (!data.pdfUrl || data.pdfUrl === "") {
                try {
                    const resSync = await fetch(`https://api.alegra.com/api/v1/invoices/${data.id}`, {
                        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
                    });
                    if (resSync.ok) data = await resSync.json();
                } catch(e) {}
            }
            
            dianResponse = {
                success: true,
                idAlegra: data.id,
                cufe: data.cufe || 'POR-PROCESAR',
                nroFactura: data.numberFull,
                pdfUrl: data.pdfUrl || data.publicUrl || `https://app.alegra.com/invoice/view/id/${data.id}?format=pdf`,
                xmlUrl: data.xmlUrl || '',
                fechaReporte: new Date().toLocaleString(),
                isSample: false,
                proveedor: 'alegra'
            };

        } else {
            throw new Error(`El proveedor '${dian.dianProveedor}' aún no está configurado para envíos reales.`);
        }

        // 4. Actualizar el pedido en la base de datos con la respuesta DIAN
        pedido.dian = dianResponse;
        pedido.inventarioDescontado = true; // Sello de seguridad adicional
        pedido.moverStock = false;          // ORDEN EXPLÍCITA: No tocar inventario

        await API.savePedido(pedido);

        return dianResponse;
    },

    obtenerDocumentoDIAN: async (idPedido, tipo = 'pdf') => {
        try {
            const config = await API.getConfig();
            const pedidos = await API.getPedidos();
            const p = pedidos.find(x => x.id == idPedido);
            if (!p) throw new Error("Pedido no encontrado");

            let finalUrl = null;

            if (config.empresa?.dianProveedor === 'alegra' && tipo === 'pdf') {
                let idAlegra = p.dian?.idAlegra;
                if (!idAlegra) {
                    const res = await API.reportarPedidoADian(idPedido);
                    idAlegra = res.idAlegra;
                }
                if (!idAlegra) throw new Error("No se pudo identificar el ID en Alegra.");

                const auth = btoa(`${config.empresa.dianCampos.email}:${config.empresa.dianCampos.token}`);
                finalUrl = await API._fetchAlegraPdfURL(idAlegra, auth);
            } else {
                finalUrl = p.dian ? p.dian[tipo === 'pdf' ? 'pdfUrl' : 'xmlUrl'] : null;
                if (!finalUrl || finalUrl.startsWith('blob:')) {
                    const res = await API.reportarPedidoADian(idPedido);
                    finalUrl = res[tipo === 'pdf' ? 'pdfUrl' : 'xmlUrl'];
                }
            }

            if (finalUrl) {
                console.log("Documento obtenido:", finalUrl);
                return finalUrl;
            }
            throw new Error("No se pudo generar el enlace del documento.");
        } catch (e) {
            console.error("Error al obtener documento:", e);
            throw e;
        }
    },

    // --- MANEJO ROBUSTO DE IMÁGENES ---
    // Icono SVG local para evitar errores de red en Electron
    DEFAULT_IMAGE: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzRhNTU2OCIgc3Ryb2tlLXdpZHRoPSIxIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0yMSA4YTIgMiAwIDAgMC0xLTEuNzNsLTctNGEyIDIgMCAwIDAtMiAwbC03IDRhMiAyIDAgMCAwLTEgMS43M3Y4YTIgMiAwIDAgMCAxIDEuNzNsNyA0YTIgMiAwIDAgMCAyIDBsNy00YTIgMiAwIDAgMCAxLTEuNzNaIj48L3BhdGg+PHBhdGggZD0ibTMuMyA3IDguNyA1IDguNy01Ij48L3BhdGg+PHBhdGggZD0iTTEyIDIyVjEyIj48L3BhdGg+PC9zdmc+",
    
    fixImage: (img) => {
        if(!img || img.trim() === "" || img === "null") return API.DEFAULT_IMAGE;
        return img;
    },

    // --- AYUDANTES INTERNOS ALEGRA ---
    _fetchAlegraPdfURL: async (idAlegra, auth) => {
        try {
            // Paso 1: Obtener la URL del PDF desde los metadatos de la factura
            const urlMeta = `https://api.alegra.com/api/v1/invoices/${idAlegra}`;
            let resMeta = await fetch(urlMeta, {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json'
                }
            });

            if (!resMeta.ok) {
                const errText = await resMeta.text();
                try {
                    const jsonErr = JSON.parse(errText);
                    throw new Error(jsonErr.message || "Error al consultar factura en Alegra");
                } catch(e) {
                    throw new Error(`Error en API Alegra (${resMeta.status})`);
                }
            }

            // Paso 1: Esperar a que Alegra genere el archivo técnico si es muy reciente
            await new Promise(r => setTimeout(r, 2500));

            // Reconsultar con todos los campos posibles de PDF
            resMeta = await fetch(`https://api.alegra.com/api/v1/invoices/${idAlegra}?fields=pdf,pdfUrl,publicUrl,files`, {
                headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
            });

            const data = await resMeta.json();
            const getUrl = (val) => (val && typeof val === 'object' ? (val.downloadUrl || val.url) : val);
            let pdfUrl = getUrl(data.pdf) || getUrl(data.pdfUrl) || (data.files && data.files[0]?.downloadUrl) || data.publicUrl;
            if (pdfUrl && typeof pdfUrl !== 'string') pdfUrl = null;

            // FALLBACK: Si no hay URL en metadatos, intentar sub-recursos conocidos
            if (!pdfUrl) {
                console.log("No se encontró URL en metadatos. Probando sub-recursos de descarga...");
                pdfUrl = `https://api.alegra.com/api/v1/invoices/${idAlegra}/download`;
            }

            // Paso 2: Descargar el binario usando la URL obtenida y los mismos headers de auth
            try {
                let resBlob = await fetch(pdfUrl, {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Accept': 'application/pdf'
                    }
                });

                // Si el primer intento de descarga falla o devuelve JSON, probar el sub-recurso /pdf
                const checkContent = async (res) => {
                    const ct = res.headers.get('Content-Type') || '';
                    return ct.includes('application/pdf');
                };

                if (!resBlob.ok || !(await checkContent(resBlob.clone()))) {
                    console.log("Primer intento de descarga no binaria o fallido. Probando /pdf...");
                    const altUrl = `https://api.alegra.com/api/v1/invoices/${idAlegra}/pdf`;
                    const resAlt = await fetch(altUrl, {
                        headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/pdf' }
                    });
                    if (resAlt.ok && (await checkContent(resAlt.clone()))) {
                        resBlob = resAlt;
                    }
                }

                if (resBlob.ok && (await checkContent(resBlob.clone()))) {
                    const blob = await resBlob.blob();
                    if (blob.size > 1000) {
                        return URL.createObjectURL(blob);
                    }
                }
            } catch (fetchErr) {
                console.warn("Fetch bloqueado (CORS?). Usando fallback de ventana nueva...", fetchErr);
            }

            // FALLBACK FINAL: Segurización de URL
            if (!pdfUrl || typeof pdfUrl !== 'string' || pdfUrl.includes('null')) {
                console.warn("URL de PDF inválida. Usando visor de respaldo.");
                pdfUrl = `https://app.alegra.com/invoice/view/id/${idAlegra}`;
            }

            return pdfUrl; 
        } catch (e) {
            console.error("Error crítico en _fetchAlegraPdfURL:", e);
            throw e;
        }
    },

    // Ayudante para descarga directa sin metadatos
    _fetchAlegraPdfURL_Direct: async (url, auth) => {
        const res = await fetch(url, {
            headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/pdf' }
        });
        if (!res.ok) throw new Error("Error en descarga directa de PDF");
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    },

    _getAlegraTaxes: async (auth) => {
        try {
            const res = await fetch('https://api.alegra.com/api/v1/taxes', {
                headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
            });
            if (res.ok) return await res.json();
            return [];
        } catch(e) { return []; }
    },

    _getAlegraItemId: async (item, auth, suggestedTaxId = 1) => {
        const headers = {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        try {
            // 1. Buscar por REFERENCIA (Más preciso que el nombre)
            const ref = item.referencia || '';
            const searchUrl = `https://api.alegra.com/api/v1/items?query=${encodeURIComponent(ref)}&limit=1`;
            const resSearch = await fetch(searchUrl, { headers });
            
            if (resSearch.ok) {
                const results = await resSearch.json();
                const existingItem = results.find(x => x.reference === ref);

                if (existingItem) {
                    // Si el nombre en Alegra es diferente al nombre limpio (ej: tiene la unidad pegada), lo actualizamos
                    if (existingItem.name !== item.nombre || (existingItem.inventory && existingItem.inventory.unit !== 'unit')) {
                        console.log(`[DIAN] Sincronizando nombre e inventario en Alegra para: ${item.nombre}`);
                        await fetch(`https://api.alegra.com/api/v1/items/${existingItem.id}`, {
                            method: 'PUT',
                            headers,
                            body: JSON.stringify({
                                name: item.nombre,
                                inventory: { unit: 'unit' }
                            })
                        });
                    }
                    return existingItem.id;
                }
            }

            // 2. Si no existe por referencia, crearlo
            const pPerc = parseFloat(item.iva || 0);
            const unitNeto = item.precio / (1 + (pPerc / 100));

            const rawUnit = item.unidad ? item.unidad.toString().trim() : '';

            const createPayload = {
                name: item.nombre, // Siempre nombre limpio
                description: `Unidad: ${rawUnit || 'Und'} | Ref: ${item.referencia || '---'}`,
                price: unitNeto,
                reference: item.referencia || '',
                tax: [{ id: suggestedTaxId }],
                inventory: { 
                    unit: 'unit',
                    availableQuantity: item.existencia || 0
                }
            };

            const resCreate = await fetch('https://api.alegra.com/api/v1/items', {
                method: 'POST',
                headers,
                body: JSON.stringify(createPayload)
            });

            if (!resCreate.ok) {
                const errData = await resCreate.json();
                throw new Error(`Error Alegra al crear ítem '${item.nombre}': ` + (errData.message || resCreate.statusText));
            }

            const data = await resCreate.json();
            return data.id;
        } catch (e) {
            console.error("Error en _getAlegraItemId:", e);
            throw e;
        }
    },

    descargarExcelMHT: (htmlContent, fileName, logoBase64 = '') => {
        const template = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta http-equiv="content-type" content="text/html; charset=utf-8">
                <style>
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ccc; padding: 5px; white-space: nowrap; font-family: Arial, sans-serif; }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    th { background-color: #f1f5f9; font-weight: bold; }
                </style>
                <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
            </head>
            <body>{table}</body></html>`;
        
        const base64 = (s) => window.btoa(unescape(encodeURIComponent(s)));
        const format = (s, c) => s.replace(/{(\w+)}/g, (m, p) => c[p]);
        
        let finalHtml = htmlContent;
        let mhtContent = "";
        
        if (logoBase64 && logoBase64.startsWith('data:image')) {
            const imgData = logoBase64.split(',')[1];
            const mimeType = logoBase64.split(';')[0].split(':')[1];
            
            mhtContent = `MIME-Version: 1.0
Content-Type: multipart/related; boundary="----boundary-libre"

------boundary-libre
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: base64

${base64(format(template, { worksheet: 'Reporte', table: finalHtml }))}

------boundary-libre
Content-Type: ${mimeType}
Content-Transfer-Encoding: base64
Content-ID: <logo>

${imgData}

------boundary-libre--`;

            const blob = new Blob([mhtContent], { type: 'application/x-mimearchive' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = fileName + ".xls";
            link.click();
        } else {
            const ctx = { worksheet: 'Reporte', table: finalHtml };
            const mhtSimple = `MIME-Version: 1.0
Content-Type: text/html; charset="utf-8"
Content-Transfer-Encoding: base64

${base64(format(template, ctx))}`;
            
            const blob = new Blob([mhtSimple], { type: 'application/x-mimearchive' });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = fileName + ".xls";
            link.click();
        }
    },

    // --- MÓDULO FACTURAS DE COMPRA (INDEPENDIENTE) ---
    getFacturasCompras: () => apiRequest('/api/facturas-compras'),
    saveFacturaCompra: (f) => apiRequest('/api/facturas-compras', 'POST', f),
    deleteFacturaCompra: (id) => apiRequest(`/api/facturas-compras/${id}`, 'DELETE'),
    getProvedoresCompras: () => apiRequest('/api/provedores-compras'),
    saveProvedorCompra: (p) => apiRequest('/api/provedores-compras', 'POST', p),
    deleteProvedorCompra: (id) => apiRequest(`/api/provedores-compras/${id}`, 'DELETE')
};
