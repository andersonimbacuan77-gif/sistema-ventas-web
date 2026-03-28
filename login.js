document.addEventListener('DOMContentLoaded', async () => {
    // Verificar si ya hay una sesión activa para redirigir
    const session = await window.electronAPI.readData('session.json');
    if (session && session.currentUser) {
        window.location.href = 'catalog.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const authSubtitle = document.getElementById('auth-subtitle');
    const brandingEl = document.getElementById('dynamic-branding');

    // FASE 74 FIX: Leer config desde la API del servidor (MongoDB) para compatibilidad web y móvil
    let appConfig = {};
    try {
        const r = await fetch('/api/data/config.json?v=' + Date.now());
        appConfig = await r.json() || {};
    } catch(e) {
        // Fallback a Electron si está disponible
        try {
            if (window.electronAPI && window.electronAPI.readData) {
                appConfig = await window.electronAPI.readData('config.json') || {};
            }
        } catch(e2) {}
    }
    
    const appName = appConfig.company?.name || appConfig.company?.appName || 'CatalogApp';
    
    // Convertir el nombre en letras individuales con variables CSS para la onda
    brandingEl.innerHTML = appName.split('').map((char, index) => 
        `<span style="--i:${index}">${char === ' ' ? '&nbsp;' : char}</span>`
    ).join('');

    // Cambiar entre formularios
    document.getElementById('go-to-register').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        authSubtitle.textContent = 'Crea tu cuenta gratis';
    });

    document.getElementById('go-to-login').addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'flex';
        authSubtitle.textContent = 'Ingresa para ver el catálogo';
    });

    // Envío del Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(loginForm));
        let users = await window.electronAPI.readData('users.json') || [];
        
        // AUTO-CREAR ADMIN SI NO EXISTE NINGÚN USUARIO
        if (users.length === 0 && data.username === 'admin' && data.password === '1234') {
            const adminUser = { ...data, role: 'admin', fullname: 'Administrador Maestro' };
            users.push(adminUser);
            await window.electronAPI.writeData('users.json', users);
            // Iniciar sesión inmediatamente con el nuevo usuario
            await window.electronAPI.writeData('session.json', { currentUser: adminUser });
            window.location.href = 'catalog.html';
            return;
        }

        const user = users.find(u => u.username === data.username && u.password === data.password);
        if (user) {
            await window.electronAPI.writeData('session.json', { currentUser: user });
            window.location.href = 'catalog.html';
        } else {
            alert('Usuario o contraseña incorrectos.');
        }
    });

    // Envío del Registro
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(registerForm));
        let users = await window.electronAPI.readData('users.json') || [];
        
        if (users.find(u => u.username === data.username)) {
            return alert('El nombre de usuario ya está ocupado. Elige otro.');
        }

        // Primer usuario siempre es admin, el resto son usuarios normales
        const newUser = { 
            ...data, 
            role: users.length === 0 ? 'admin' : 'user' 
        };

        users.push(newUser);
        await window.electronAPI.writeData('users.json', users);
        await window.electronAPI.writeData('session.json', { currentUser: newUser });
        window.location.href = 'catalog.html';
    });
});
