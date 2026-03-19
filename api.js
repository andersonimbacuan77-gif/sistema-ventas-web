const API_URL = 'https://sistema-ventas-web.onrender.com';

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
            try {
                const error = JSON.parse(text);
                throw new Error(error.message || `Error ${response.status}`);
            } catch(e) {
                throw new Error(`Error del servidor (${response.status}): Verifique el tamaño de la imagen o la conexión.`);
            }
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
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
        let mht = `MIME-Version: 1.0\r\n`;
        mht += `Content-Type: multipart/related; boundary="${boundary}"\r\n\r\n`;
        
        let htmlContent = `<html><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
        
        mht += `--${boundary}\r\n`;
        mht += `Content-Type: text/html; charset="utf-8"\r\n`;
        mht += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
        mht += htmlContent + `\r\n\r\n`;

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
        a.download = `${nombre}.xls`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    getExcelHeader: async (cols) => {
        try {
            const config = await API.getConfig();
            let emp = { nombre: 'MI EMPRESA', nit: '', direccion: '', telefono: '', logoBase64: '' };
            if (config && config.empresa) emp = { ...emp, ...config.empresa };
            
            let logoHtml = '';
            let contentCols = cols;
            if (emp.logoBase64) {
                logoHtml = `<th rowspan="3" width="80" style="text-align:center; vertical-align:middle; background:white; border:1px solid #ccc;"><img src="cid:logo" width="60" height="60"></th>`;
                contentCols = cols - 1;
            }

            const headerHtml = `
                <tr height="25">${logoHtml}<th colspan="${contentCols}" style="font-size: 16px; font-weight: bold; background:#f8fafc; color: #0f172a; text-align: center;">${emp.nombre.toUpperCase()}</th></tr>
                <tr height="20"><th colspan="${contentCols}" style="font-size: 13px; background:#f8fafc; color: #475569; text-align: center;">NIT: ${emp.nit} | TEL: ${emp.telefono}</th></tr>
                <tr height="20"><th colspan="${contentCols}" style="font-size: 13px; background:#f8fafc; color: #475569; text-align: center; border-bottom: 2px solid #cbd5e1;">${emp.direccion}</th></tr>
            `;
            return { headerHtml, logoBase64: emp.logoBase64 };
        } catch(e) {
            console.error("Error generating Excel header:", e);
            return { headerHtml: `<tr><th colspan="${cols}">REPORTE</th></tr>`, logoBase64: null };
        }
    }
};
