const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3344;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir archivos estáticos (Frontend) - DEBE IR PRIMERO QUE LAS RUTAS
app.use(express.static(path.join(__dirname)));

// --- MODELOS DE DATOS (JSON) ---
const Producto = db.Producto;
const Usuario = db.Usuario;
const Pedido = db.Pedido;
const Reporte = db.Reporte;
const Ingreso = db.Ingreso;
const Egreso = db.Egreso;
const Config = db.Config;
const FacturaCompra = db.FacturaCompra;
const ProveedorCompra = db.ProveedorCompra;

// --- INICIALIZACIÓN LOCAL ---
console.log(`✅ Usando sistema de archivos JSON local`);

// --- MÓDULO FACTURAS DE COMPRA (INDEPENDIENTE) ---
app.get('/api/test-compras', (req, res) => res.json({ status: 'ok', message: 'Módulo de compras activo' }));

app.get('/api/facturas-compras', async (req, res) => {
    try {
        const facturas = await FacturaCompra.find();
        res.json(facturas);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener facturas de compra' });
    }
});

app.post('/api/facturas-compras', async (req, res) => {
    const f = req.body;
    try {
        if (!f.id) f.id = Date.now().toString();
        const { _id, ...fields } = f;
        await FacturaCompra.findOneAndUpdate({ id: f.id }, { $set: fields }, { upsert: true, new: true });
        if (f.proveedor && f.nit) {
            const nombreNormalizado = f.proveedor.trim().toUpperCase();
            const provExistente = await ProveedorCompra.findOne({ nombre: nombreNormalizado });
            if (!provExistente) {
                await ProveedorCompra.findOneAndUpdate({ nombre: nombreNormalizado }, {
                    $set: { nombre: nombreNormalizado, nit: f.nit.trim() }
                }, { upsert: true });
            } else if (provExistente.nit !== f.nit.trim()) {
                await ProveedorCompra.findOneAndUpdate({ nombre: nombreNormalizado }, { $set: { nit: f.nit.trim() } });
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error("Error saving factura compra:", error);
        res.status(500).json({ error: error.message || 'Error al guardar factura de compra' });
    }
});

app.get('/api/provedores-compras', async (req, res) => {
    try {
        const proveedores = await ProveedorCompra.find();
        res.json(proveedores);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener lista de proveedores' });
    }
});

app.delete('/api/facturas-compras/:id', async (req, res) => {
    try {
        await FacturaCompra.findOneAndDelete({ id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar factura de compra' });
    }
});

app.post('/api/provedores-compras', async (req, res) => {
    const p = req.body;
    try {
        // Usamos _id para consistencia con los registros autogenerados
        if (!p._id) p._id = Date.now().toString();
        p.nombre = p.nombre.trim().toUpperCase();
        await ProveedorCompra.findOneAndUpdate({ nombre: p.nombre }, p, { upsert: true });
        res.json({ success: true });
    } catch (error) {
        console.error("Error saving provider:", error);
        res.status(500).json({ error: 'Error al guardar proveedor' });
    }
});

app.delete('/api/provedores-compras/:id', async (req, res) => {
    try {
        // Buscamos por _id que es el campo usado en provedores_compras.json
        await ProveedorCompra.findOneAndDelete({ _id: req.params.id });
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting provider:", error);
        res.status(500).json({ error: 'Error al eliminar proveedor' });
    }
});
// --- FIN MÓDULO COMPRAS ---

// API lista.

// 1. Productos - Obtener todos
app.get('/api/productos', async (req, res) => {
    try {
        const productos = await Producto.find();
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// 2. Productos - Guardar/Actualizar (soporta objeto único O array completo)
app.post('/api/productos', async (req, res) => {
    const data = req.body;
    try {
        const upsertProducto = async (p) => {
            const { _id, ...fields } = p; // Separar _id del resto para evitar error de campo inmutable
            const filter = p.codigo ? { codigo: p.codigo } : { _id: _id || Date.now().toString() };
            await Producto.findOneAndUpdate(filter, { $set: fields }, { upsert: true, new: true });
        };
        if (Array.isArray(data)) {
            for (const p of data) await upsertProducto(p);
        } else {
            await upsertProducto(data);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving producto:', error);
        res.status(500).json({ error: 'Error al guardar producto: ' + error.message });
    }
});

// 3. Configuración
app.get('/api/config', async (req, res) => {
    try {
        let config = await Config.findOne({ id: 'main' });
        if (!config) {
            config = { id: 'main', categorias: [], unidades: [], empresa: {}, bloquearRegistro: false };
        } else if (config.bloquearRegistro === undefined) {
            config.bloquearRegistro = false;
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        const { _id, ...fields } = req.body;
        await Config.findOneAndUpdate({ id: 'main' }, { $set: fields }, { upsert: true, new: true });
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving config:', error);
        res.status(500).json({ error: 'Error al guardar configuración: ' + error.message });
    }
});

// 4. Usuarios / Login
app.get('/api/usuarios', async (req, res) => {
    try {
        const users = await Usuario.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

app.post('/api/usuarios', async (req, res) => {
    try {
        const users = req.body;
        if (!Array.isArray(users)) {
            return res.status(400).json({ error: 'Formato de datos inválido' });
        }
        
        // Asegurarnos de que el admin siempre exista
        const adminEnLista = users.some(u => u.user === 'admin');
        if (!adminEnLista) {
            const adminActual = await Usuario.findOne({ user: 'admin' });
            if (adminActual) users.push(adminActual.toObject());
        }

        // Upsert por 'user' (nombre de usuario) - seguro y sin colisión de _id
        for (const u of users) {
            const { _id, ...fields } = u;
            await Usuario.findOneAndUpdate({ user: u.user }, { $set: fields }, { upsert: true, new: true });
        }

        // Eliminar usuarios que ya no están en la lista (sincronización completa)
        const usernames = users.map(u => u.user);
        await Usuario.deleteMany({ user: { $nin: usernames } });

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving users:', error);
        res.status(500).json({ error: 'Error al guardar usuarios: ' + error.message });
    }
});

app.post('/api/register', async (req, res) => {
    const { nombre, user, pass } = req.body;
    try {
        const config = await Config.findOne({ id: 'main' });
        if (config && config.bloquearRegistro) {
            return res.status(403).json({ error: 'El registro de nuevos usuarios está deshabilitado por el administrador.' });
        }

        const existe = await Usuario.findOne({ user });
        if (existe) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        const nuevo = new Usuario({ 
            nombre, 
            user, 
            pass, 
            rol: 'cliente',
            canEditPrice: false,
            permExcel: false, 
            permPrint: false, 
            permTicket: false, 
            permWA: false, 
            permDian: false 
        });
        await nuevo.save();
        res.json({ success: true, user: nuevo });
    } catch (error) {
        console.error('Register Error:', error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

app.post('/api/login', async (req, res) => {
    const { user, pass } = req.body;
    try {
        const cuenta = await Usuario.findOne({ user, pass });
        if (cuenta) {
            res.json({ success: true, user: cuenta });
        } else {
            res.status(401).json({ success: false, message: 'Usuario o clave incorrectos' });
        }
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});
app.delete('/api/productos/:id', async (req, res) => {
    try {
        const idParam = req.params.id;
        // Intentar por _id primero (lo que envía el frontend: timestamp string de MongoDB)
        let result = await Producto.findByIdAndDelete(idParam);
        if (!result) {
            // Fallback: buscar por codigo por si acaso
            result = await Producto.findOneAndDelete({ codigo: idParam });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting producto:', error);
        res.status(500).json({ error: 'Error al eliminar producto: ' + error.message });
    }
});

// 6. Pedidos - Obtener todos
app.get('/api/pedidos', async (req, res) => {
    try {
        const pedidos = await Pedido.find().sort({ id: -1 });
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

// 7. Pedidos - Guardar uno nuevo
// Cola de procesamiento serializada para evitar condiciones de carrera en pedidos
let queuePedidos = Promise.resolve();
// CACHÉ DE MEMORIA RAM: Blindaje instantáneo para evitar doble procesamiento en la misma sesión
const pedidosProcesadosEnSesion = new Set();

app.post('/api/pedidos', async (req, res) => {
    // BLOQUEO SÍNCRONO: Esperamos a que la cola de pedidos termine físicamente antes de responder
    await (queuePedidos = queuePedidos.then(async () => {
        const p = req.body;
        try {
            if (!p.id) {
                if (!res.headersSent) res.status(400).json({ error: 'Pedido sin ID' });
                return;
            }
            
            // --- REGLA DE ORO: SEPARACIÓN FISCAL VS INVENTARIO (JERARQUÍA DE ÓRDENES) ---
            // El servidor SOLO moverá stock si el cliente envía explícitamente moverStock: true.
            if (p.moverStock !== true) {
                p.inventarioDescontado = true; // Aseguramos que el flag se mantenga en disco
                await Pedido.findOneAndUpdate({ id: p.id }, p, { upsert: true });
                if (!res.headersSent) res.json({ success: true });
                return;
            }

            // 1. VERIFICACIÓN DE PRIMER NIVEL: Memoria RAM (Idempotencia)
            if (pedidosProcesadosEnSesion.has(p.id)) {
                p.inventarioDescontado = true;
                await Pedido.findOneAndUpdate({ id: p.id }, p, { upsert: true });
                if (!res.headersSent) res.json({ success: true });
                return;
            }

            // Marcamos el inicio del proceso para bloquear reintentos
            pedidosProcesadosEnSesion.add(p.id);

            // 2. VERIFICACIÓN DE SEGUNDO NIVEL: Disco Duro
            const existeEnDisco = await Pedido.findOne({ id: p.id });
            const yaDescontadoEnDisco = existeEnDisco && (existeEnDisco.inventarioDescontado === true || existeEnDisco.inventarioDescontado === "true");

            if (!yaDescontadoEnDisco) {
                if (p.items && Array.isArray(p.items)) {
                    for (const item of p.items) {
                        if (!item.referencia) continue;
                        const cant = Number(item.cantidad) || 0;
                        await Producto.findOneAndUpdate(
                            { codigo: item.referencia },
                            { $inc: { existencia: -cant } }
                        );
                    }
                }
                p.inventarioDescontado = true;
            } else {
                p.inventarioDescontado = true;
            }

            // 3. PERSISTENCIA FINAL
            await Pedido.findOneAndUpdate({ id: p.id }, p, { upsert: true });
            
            if (!res.headersSent) res.json({ success: true });
        } catch (error) {
            console.error('Error saving order:', error);
            if (!res.headersSent) res.status(500).json({ error: 'Error al guardar pedido' });
        }
    }).catch(e => {
        console.error("Fallo crítico en la cola de pedidos:", e);
        queuePedidos = Promise.resolve();
        if (!res.headersSent) res.status(500).json({ error: "Fallo en el servidor" });
    }));
});

app.delete('/api/pedidos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const pedido = await Pedido.findOne({ id });
        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        // DEVOLVER EXISTENCIAS AL INVENTARIO (Solo si revert no es 'false')
        const revertir = req.query.revert !== 'false';

        if (revertir && pedido.items && Array.isArray(pedido.items)) {
            for (const item of pedido.items) {
                if (!item.referencia) continue;
                const cant = Number(item.cantidad) || 0;
                await Producto.findOneAndUpdate(
                    { codigo: item.referencia },
                    { $inc: { existencia: cant } }
                );
            }
        }

        await Pedido.findOneAndDelete({ id });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ error: 'Error al eliminar pedido' });
    }
});

app.post('/api/delete-all-pedidos', async (req, res) => {
    try {
        await Pedido.deleteMany({});
        // NOTA: Esta acción NO reversa existencias, solo limpia el historial.
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al limpiar pedidos' });
    }
});

// 8. Historial de Reportes
app.get('/api/reportes', async (req, res) => {
    try {
        const reportes = await Reporte.find();
        res.json(reportes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener reportes' });
    }
});

app.post('/api/reportes', async (req, res) => {
    try {
        const reportes = req.body;
        const upsertReporte = async (r) => {
            if (!r.idReporte) return;
            const { _id, ...fields } = r;
            await Reporte.findOneAndUpdate({ idReporte: r.idReporte }, { $set: fields }, { upsert: true, new: true });
        };
        if (Array.isArray(reportes)) {
            for (const r of reportes) await upsertReporte(r);
        } else {
            await upsertReporte(reportes);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving reportes:', error);
        res.status(500).json({ error: 'Error al guardar reportes: ' + error.message });
    }
});

app.delete('/api/reportes/:id', async (req, res) => {
    try {
        await Reporte.findOneAndDelete({ idReporte: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar reporte' });
    }
});

// 9. Ingresos
app.get('/api/ingresos', async (req, res) => {
    try {
        const registros = await Ingreso.find();
        res.json(registros);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener ingresos' });
    }
});

app.post('/api/ingresos', async (req, res) => {
    try {
        const data = req.body;
        const upsertIngreso = async (item) => {
            if (!item.id) return;
            const { _id, ...fields } = item;
            await Ingreso.findOneAndUpdate({ id: item.id }, { $set: fields }, { upsert: true, new: true });
        };
        if (Array.isArray(data)) {
            for (const item of data) await upsertIngreso(item);
        } else {
            await upsertIngreso(data);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving ingresos:', error);
        res.status(500).json({ error: 'Error al guardar ingresos: ' + error.message });
    }
});

app.delete('/api/ingresos/:id', async (req, res) => {
    try {
        await Ingreso.findOneAndDelete({ id: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar ingreso' });
    }
});

// 10. Egresos
app.get('/api/egresos', async (req, res) => {
    try {
        const registros = await Egreso.find();
        res.json(registros);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener egresos' });
    }
});

app.post('/api/egresos', async (req, res) => {
    try {
        const data = req.body;
        const upsertEgreso = async (item) => {
            if (!item.id) return;
            const { _id, ...fields } = item;
            await Egreso.findOneAndUpdate({ id: item.id }, { $set: fields }, { upsert: true, new: true });
        };
        if (Array.isArray(data)) {
            for (const item of data) await upsertEgreso(item);
        } else {
            await upsertEgreso(data);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving egresos:', error);
        res.status(500).json({ error: 'Error al guardar egresos: ' + error.message });
    }
});

app.delete('/api/egresos/:id', async (req, res) => {
    try {
        await Egreso.findOneAndDelete({ id: parseInt(req.params.id) });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar egreso' });
    }
});

// 11. Reiniciar Sistema (Borrado de Transacciones y Stock a 0)
app.post('/api/reset-system', async (req, res) => {
    try {
        // RESETEAR STOCK A 0 (No eliminar productos)
        await Producto.updateMany({}, { $set: { existencia: 0 } });
        
        // ELIMINAR TRANSACCIONES
        await Pedido.deleteMany({});
        await Ingreso.deleteMany({});
        await Egreso.deleteMany({});
        
        // NOTA: reportes, usuarios y configuracion se mantienen intactos
        
        res.json({ success: true });
    } catch (error) {
        console.error('Reset system error:', error);
        res.status(500).json({ error: 'Error al reiniciar sistema' });
    }
});

// 12. Vaciar Todos los Productos (Borrado Total de la Colección)
app.post('/api/delete-all-products', async (req, res) => {
    try {
        await Producto.deleteMany({});
        res.json({ success: true });
    } catch (error) {
        console.error('Delete all products error:', error);
        res.status(500).json({ error: 'Error al vaciar productos' });
    }
});


// --- FIN MÓDULO COMPRAS ---

// 13. PANEL DE RESPALDO - Listar colecciones disponibles
app.get('/api/backup/colecciones', (req, res) => {
    const colecciones = [
        { id: 'productos',        nombre: 'Productos',               icono: '📦', descripcion: 'Catálogo completo de productos e inventario' },
        { id: 'pedidos',          nombre: 'Pedidos / Ventas',        icono: '🧾', descripcion: 'Historial de órdenes y ventas realizadas' },
        { id: 'ingresos',         nombre: 'Ingresos (Entradas)',      icono: '📥', descripcion: 'Registros de entradas de mercancía' },
        { id: 'egresos',          nombre: 'Egresos (Salidas)',        icono: '📤', descripcion: 'Registros de salidas de mercancía' },
        { id: 'reportes',         nombre: 'Reportes de Caja',        icono: '📊', descripcion: 'Historial de cierres de caja y reportes' },
        { id: 'usuarios',         nombre: 'Usuarios del Sistema',    icono: '👥', descripcion: 'Cuentas y permisos de los usuarios' },
        { id: 'config',           nombre: 'Configuración General',   icono: '⚙️',  descripcion: 'Categorías, unidades y datos de la empresa' },
        { id: 'facturas_compras', nombre: 'Facturas de Compra',      icono: '🧾', descripcion: 'Facturas electrónicas de compra registradas' },
        { id: 'proveedores',      nombre: 'Proveedores',             icono: '🏭', descripcion: 'Directorio de proveedores registrados' },
    ];
    res.json(colecciones);
});

// 14. PANEL DE RESPALDO - Descargar una colección como JSON
app.get('/api/backup/:coleccion', async (req, res) => {
    const { coleccion } = req.params;
    try {
        let data;
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        let filename = `backup_${coleccion}_${ts}.json`;

        switch (coleccion) {
            case 'productos':        data = await Producto.find();       break;
            case 'pedidos':          data = await Pedido.find();         break;
            case 'ingresos':         data = await Ingreso.find();        break;
            case 'egresos':          data = await Egreso.find();         break;
            case 'reportes':         data = await Reporte.find();        break;
            case 'usuarios':         data = await Usuario.find();        break;
            case 'config':           data = await Config.find();         break;
            case 'facturas_compras': data = await FacturaCompra.find();  break;
            case 'proveedores':      data = await ProveedorCompra.find(); break;
            default:
                return res.status(404).json({ error: `Colección '${coleccion}' no encontrada.` });
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error en backup:', error);
        res.status(500).json({ error: 'Error al generar el respaldo: ' + error.message });
    }
});

// 15. PANEL DE RESPALDO - Importar datos (Upsert masivo)
app.post('/api/restore/:coleccion', async (req, res) => {
    const { coleccion } = req.params;
    const data = req.body;

    if (!Array.isArray(data)) {
        return res.status(400).json({ error: 'El formato de importación debe ser un Array de objetos JSON.' });
    }

    try {
        let Model;
        let queryField = '_id'; // Campo por defecto para buscar duplicados

        switch (coleccion) {
            case 'productos':        Model = Producto;        queryField = 'codigo'; break;
            case 'pedidos':          Model = Pedido;          queryField = 'id'; break;
            case 'ingresos':         Model = Ingreso;         queryField = 'id'; break;
            case 'egresos':          Model = Egreso;          queryField = 'id'; break;
            case 'reportes':         Model = Reporte;         queryField = 'idReporte'; break;
            case 'usuarios':         Model = Usuario;         queryField = 'user'; break;
            case 'config':           Model = Config;          queryField = 'id'; break;
            case 'facturas_compras': Model = FacturaCompra;   queryField = 'id'; break;
            case 'proveedores':      Model = ProveedorCompra; queryField = 'nombre'; break;
            default: return res.status(404).json({ error: 'Colección no válida.' });
        }

        // Procesamiento masivo por Upsert
        for (const item of data) {
            const { _id, ...fields } = item;
            const filter = {};
            
            // Si el item tiene el campo de consulta, lo usamos, si no usamos el _id si viene
            if (item[queryField]) {
                filter[queryField] = item[queryField];
            } else if (_id) {
                filter._id = _id;
            } else {
                // Si no hay forma de identificarlo, dejamos que se cree como nuevo con ID propio
                filter._id = Date.now().toString() + Math.random(); 
            }

            await Model.findOneAndUpdate(filter, { $set: fields }, { upsert: true, new: true });
        }

        res.json({ success: true, count: data.length });
    } catch (error) {
        console.error('Error en restore:', error);
        res.status(500).json({ error: 'Fallo al importar datos: ' + error.message });
    }
});

// 16. PANEL DE RESPALDO - Vaciar tabla
app.delete('/api/clear/:coleccion', async (req, res) => {
    const { coleccion } = req.params;

    if (coleccion === 'usuarios') {
        return res.status(403).json({ error: 'Por seguridad, la tabla de usuarios no puede ser vaciada colectivamente.' });
    }

    try {
        let Model;
        switch (coleccion) {
            case 'productos':        Model = Producto; break;
            case 'pedidos':          Model = Pedido; break;
            case 'ingresos':         Model = Ingreso; break;
            case 'egresos':          Model = Egreso; break;
            case 'reportes':         Model = Reporte; break;
            case 'config':           Model = Config; break;
            case 'facturas_compras': Model = FacturaCompra; break;
            case 'proveedores':      Model = ProveedorCompra; break;
            default: return res.status(404).json({ error: 'Colección no válida.' });
        }

        await Model.deleteMany({});
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al vaciar la tabla: ' + error.message });
    }
});

// Redirigir la raíz al login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});


// Iniciamos el servidor
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor corriendo en el puerto ${PORT}`);
});

// Configuraciones recomendadas por Render para evitar desconexiones intermitentes
server.keepAliveTimeout = 120000;
server.headersTimeout = 120500;

