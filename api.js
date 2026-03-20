const API_URL = (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:3000' 
    : '';

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
    deletePedido: (id) => apiRequest(`/api/pedidos/${id}`, 'DELETE'),
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

    getFechaLocal: (timestamp = null) => {
        const d = timestamp ? new Date(timestamp) : new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },

    descargarExcelMHT: (html, nombre, logoBase64 = null) => {
        const boundary = "----=_NextPart_POS_SYSTEM";
        // Usamos CRLF (\r\n) para mejor compatibilidad con el estándar MIME
        let mht = `MIME-Version: 1.0\r\n`;
        mht += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;
        
        // Parte HTML
        mht += `--${boundary}\r\n`;
        mht += `Content-Type: text/html; charset="utf-8"\r\n`;
        mht += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
        
        const template = `<html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
        mht += template + `\r\n\r\n`;

        // Parte Imagen (si existe)
        if (logoBase64 && logoBase64.includes(',')) {
            const parts = logoBase64.split(',');
            const mime = parts[0].match(/:(.*?);/)[1];
            const base64Data = parts[1];
            
            mht += `--${boundary}\r\n`;
            mht += `Content-Type: ${mime}\r\n`;
            mht += `Content-Transfer-Encoding: base64\r\n`;
            mht += `Content-ID: <logo>\r\n\r\n`;
            mht += base64Data + `\r\n\r\n`;
        }

        mht += `--${boundary}--`;

        const blob = new Blob([mht], { type: "application/vnd.ms-excel" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${nombre}_${API.getFechaLocal()}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // --- SISTEMA DE TEMAS ---
    Themes: {
        normal: {
            '--primary': '#6366f1',
            '--primary-light': '#818cf8',
            '--primary-glow': 'rgba(99, 102, 241, 0.2)',
            '--accent': '#38bdf8',
            '--bg': '#0a0b14',
            '--card-bg': 'rgba(255, 255, 255, 0.03)',
            '--header-dark': '#020617'
        },
        natural: {
            '--primary': '#64748b',
            '--primary-light': '#94a3b8',
            '--primary-glow': 'rgba(100, 116, 139, 0.1)',
            '--accent': '#94a3b8',
            '--bg': '#0f172a',
            '--card-bg': 'rgba(255, 255, 255, 0.02)',
            '--header-dark': '#020617'
        },
        vivido: {
            '--primary': '#2563eb',
            '--primary-light': '#3b82f6',
            '--primary-glow': 'rgba(37, 99, 235, 0.4)',
            '--accent': '#00e0ff',
            '--bg': '#00040d',
            '--card-bg': 'rgba(255, 255, 255, 0.05)',
            '--header-dark': '#000000'
        },
        cibernetico: {
            '--primary': '#0084ff',
            '--primary-light': '#00c3ff',
            '--primary-glow': 'rgba(0, 132, 255, 0.5)',
            '--accent': '#00f2ff',
            '--bg': '#05060f',
            '--card-bg': 'rgba(0, 132, 255, 0.05)',
            '--header-dark': '#000814'
        },
        esmeralda: {
            '--primary': '#10b981',
            '--primary-light': '#34d399',
            '--primary-glow': 'rgba(16, 185, 129, 0.4)',
            '--accent': '#34d399',
            '--bg': '#020617',
            '--card-bg': 'rgba(16, 185, 129, 0.05)',
            '--header-dark': '#000500'
        },
        atardecer: {
            '--primary': '#f59e0b',
            '--primary-light': '#fbbf24',
            '--primary-glow': 'rgba(245, 158, 11, 0.4)',
            '--accent': '#fbbf24',
            '--bg': '#0c0a09',
            '--card-bg': 'rgba(245, 158, 11, 0.05)',
            '--header-dark': '#050000'
        },
        galaxia: {
            '--primary': '#8b5cf6',
            '--primary-light': '#a78bfa',
            '--primary-glow': 'rgba(139, 92, 246, 0.4)',
            '--accent': '#a78bfa',
            '--bg': '#0f0720',
            '--card-bg': 'rgba(139, 92, 246, 0.05)',
            '--header-dark': '#050010'
        },
        rubi: {
            '--primary': '#ef4444',
            '--primary-light': '#f87171',
            '--primary-glow': 'rgba(239, 68, 68, 0.4)',
            '--accent': '#f87171',
            '--bg': '#0f0505',
            '--card-bg': 'rgba(239, 68, 68, 0.05)',
            '--header-dark': '#100000'
        }
    },

    applyTheme: (themeId) => {
        const theme = API.Themes[themeId] || API.Themes.normal;
        const root = document.documentElement;
        for (const [key, value] of Object.entries(theme)) {
            root.style.setProperty(key, value);
        }
        console.log(`Tema aplicado: ${themeId}`);
    }
};
