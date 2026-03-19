/* 
   SISCONTED - UI HELPERS
   Centralized JS for toasts, modals, and responsive interactions.
*/

const UI = {
    // --- TOAST NOTIFICATIONS ---
    showToast(msg, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if(type === 'success') icon = '✅';
        if(type === 'error') icon = '❌';
        if(type === 'warning') icon = '⚠️';

        toast.innerHTML = `<div>${icon}</div> <div>${msg}</div>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toast-out 0.4s ease forwards';
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    },

    // --- CUSTOM CONFIRMATION MODAL ---
    confirm(title, message, callback) {
        let modal = document.getElementById('globalConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'globalConfirmModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px; text-align: center;">
                    <h3 id="g-confirm-title" style="font-family: 'Orbitron', sans-serif; margin-bottom: 15px;">¿ESTÁS SEGURO?</h3>
                    <p id="g-confirm-msg" style="color: var(--text-muted); margin-bottom: 25px; font-size: 0.9rem;"></p>
                    <div style="display: flex; gap: 15px;">
                        <button id="g-confirm-yes" class="btn btn-primary" style="flex: 1;">SÍ, CONTINUAR</button>
                        <button id="g-confirm-no" class="btn btn-ghost" style="flex: 1; border: 1px solid var(--border);">CANCELAR</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        document.getElementById('g-confirm-title').innerText = title;
        document.getElementById('g-confirm-msg').innerText = message;
        modal.style.display = 'flex';

        const btnYes = document.getElementById('g-confirm-yes');
        const btnNo = document.getElementById('g-confirm-no');

        btnYes.onclick = () => {
            modal.style.display = 'none';
            if (callback) callback();
        };

        btnNo.onclick = () => {
            modal.style.display = 'none';
        };
    },

    // --- SIDEBAR TOGGLE (FOR MOBILE) ---
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('active');
        }
    },

    // --- EXCEL HEADER HELPER ---
    async getExcelHeader(cols) {
        let emp = { nombre: 'MI EMPRESA', nit: '', direccion: '', telefono: '', logoBase64: '' };
        try {
            if (window.API && typeof API.getConfig === 'function') {
                const config = await API.getConfig();
                if (config && config.empresa) emp = { ...emp, ...config.empresa };
            }
        } catch(e) { console.error("Error fetching config for Excel:", e); }
        
        let logoHtml = '';
        let actualCols = cols;
        if (emp.logoBase64) {
            logoHtml = `<th rowspan="3" width="80" style="text-align:center; vertical-align:middle; background:white; border:1px solid #ccc; height:60px;"><img src="cid:logo" width="60" height="60" style="display:block; margin:auto;"></th>`;
            actualCols--;
        }

        const headerHtml = `
            <tr height="20">${logoHtml}<th colspan="${actualCols}" style="text-align:center; font-size:16px; height:20px;">${emp.nombre.toUpperCase()}</th></tr>
            <tr height="20"><th colspan="${actualCols}" style="text-align:center; font-size:12px; height:20px;">NIT: ${emp.nit} | TEL: ${emp.telefono}</th></tr>
            <tr height="20"><th colspan="${actualCols}" style="text-align:center; font-size:11px; border-bottom:2px solid #333; height:20px;">${emp.direccion}</th></tr>
        `;

        return { headerHtml, logoBase64: emp.logoBase64 };
    }
};

// Initialize listeners for mobile menu toggle
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.querySelector('.menu-toggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', UI.toggleSidebar);
    }
});
