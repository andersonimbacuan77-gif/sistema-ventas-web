/**
 * API ADAPTER (Polyfill)
 * Emula la 'electronAPI' que antes proveía Electron a través de preload.js,
 * pero ahora utiliza fetch() para comunicarse con el servidor Express local.
 */
window.electronAPI = {
    readData: async (filename) => {
        // Redirección de sesión a LocalStorage (Fase 44 - Estabilidad Web)
        if (filename === 'session.json') {
            const localSess = localStorage.getItem('app-session');
            return localSess ? JSON.parse(localSess) : null;
        }

        try {
            const response = await fetch(`/api/data/${filename}`);
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            return await response.json();
        } catch (error) {
            console.error(`[API Adapter] Error al leer ${filename}:`, error);
            return null;
        }
    },
    writeData: async (filename, data) => {
        // Redirección de sesión a LocalStorage (Fase 44 - Estabilidad Web)
        if (filename === 'session.json') {
            localStorage.setItem('app-session', JSON.stringify(data));
            return { success: true };
        }

        try {
            const response = await fetch(`/api/data/${filename}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Error en la respuesta del servidor');
            return await response.json();
        } catch (error) {
            console.error(`[API Adapter] Error al escribir ${filename}:`, error);
            return { success: false, error: error.message };
        }
    }
};

console.log('%c✅ Adaptador Localhost Inyectado: electronAPI está activa.', 'color: #10b981; font-weight: bold;');
