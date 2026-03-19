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
    getProductos: () => apiRequest('/api/productos'),
    getConfig: () => apiRequest('/api/config'),
    saveProducto: (producto) => apiRequest('/api/productos', 'POST', producto),
    deleteProducto: (id) => apiRequest(`/api/productos/${id}`, 'DELETE'),
    getPedidos: () => apiRequest('/api/pedidos'),
    savePedido: (pedido) => apiRequest('/api/pedidos', 'POST', pedido),
    saveConfig: (config) => apiRequest('/api/config', 'POST', config),
    getUsuarios: () => apiRequest('/api/usuarios'),
    saveUsuarios: (usuarios) => apiRequest('/api/usuarios', 'POST', usuarios),
    getReportes: () => apiRequest('/api/reportes'),
    saveReportes: (data) => apiRequest('/api/reportes', 'POST', data),
    deleteReporte: (id) => apiRequest(`/api/reportes/${id}`, 'DELETE'),
    getIngresos: () => apiRequest('/api/ingresos'),
    saveIngresos: (data) => apiRequest('/api/ingresos', 'POST', data),
    getEgresos: () => apiRequest('/api/egresos'),
    saveEgresos: (data) => apiRequest('/api/egresos', 'POST', data),
    resetSystem: () => apiRequest('/api/reset-system', 'POST'),

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
    }
};
