const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Redirigir la raíz al login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.use(express.static(path.join(__dirname)));

// --- MONGODB CONNECTION ---
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
    mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => console.log('Conectado a MongoDB Atlas'))
        .catch(err => console.error('Error al conectar a MongoDB:', err));
} else {
    console.log('ADVERTENCIA: No hay MONGO_URI en .env. Usando archivos JSON locales como respaldo.');
}

// --- MONGOOSE MODELS ---

// 1. Productos
const productoSchema = new mongoose.Schema({
    nombre: String, categoria: String, unidad: String,
    codigo: { type: String, unique: true },
    precioCompra: Number, margen: Number, precio: Number,
    existencia: { type: Number, default: 0 }, imagen: String
}, { collection: 'productos' });
const Producto = mongoose.models.Producto || mongoose.model('Producto', productoSchema);

// 2. Usuarios
const usuarioSchema = new mongoose.Schema({
    user: { type: String, unique: true }, pass: String, nombre: String, rol: String,
    canEditPrice: Boolean, permExcel: Boolean, permPrint: Boolean, permTicket: Boolean, permWA: Boolean
}, { collection: 'usuarios', strict: false });
const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);

// 3. Configuración
const configSchema = new mongoose.Schema({}, { collection: 'configuracion', strict: false });
const Configuracion = mongoose.models.Configuracion || mongoose.model('Configuracion', configSchema);

// 4. Pedidos (Ventas)
const pedidoSchema = new mongoose.Schema({
    id: { type: Number, unique: true }, fecha: String, hora: String,
    cliente: String, items: Array, total: Number
}, { collection: 'pedidos', strict: false });
const Pedido = mongoose.models.Pedido || mongoose.model('Pedido', pedidoSchema);

// 5. Reportes (Historial de cierres/resúmenes)
const reporteSchema = new mongoose.Schema({
    id: Number, fecha: String, admin: String, rango: String,
    ventas: String, utilidad: String, pedidos: Number
}, { collection: 'reportes', strict: false });
const Reporte = mongoose.models.Reporte || mongoose.model('Reporte', reporteSchema);

// 6. Ingresos (Movimientos de stock)
const ingresoSchema = new mongoose.Schema({}, { collection: 'ingresos', strict: false });
const Ingreso = mongoose.models.Ingreso || mongoose.model('Ingreso', ingresoSchema);

// 7. Egresos
const egresoSchema = new mongoose.Schema({}, { collection: 'egresos', strict: false });
const Egreso = mongoose.models.Egreso || mongoose.model('Egreso', egresoSchema);

// --- HELPER: FALLBACK JSON ---
const ensureFiles = () => {
    const files = {
        'usuarios.json': [{ user: 'admin', pass: 'admin', nombre: 'Admin System', rol: 'admin' }],
        'config.json': { categorias: [], unidades: [], empresa: { nombre: 'MI EMPRESA' } },
        'database.json': [], 'pedidos.json': [], 'reportes.json': [], 'ingresos.json': [], 'egresos.json': []
    };
    Object.keys(files).forEach(f => {
        const p = path.join(__dirname, f);
        if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(files[f], null, 2));
    });
};
ensureFiles();

// --- API ROUTES ---

// LOGIN
app.post('/api/login', async (req, res) => {
    const { user, pass } = req.body;
    try {
        if (mongoose.connection.readyState === 1) {
            const cuenta = await Usuario.findOne({ user, pass });
            if (cuenta) return res.json({ success: true, user: cuenta });
        }
        // Fallback JSON
        const usuarios = JSON.parse(fs.readFileSync(path.join(__dirname, 'usuarios.json'), 'utf8'));
        const cuentaJson = usuarios.find(u => u.user === user && u.pass === pass);
        if (cuentaJson) return res.json({ success: true, user: cuentaJson });
        
        res.status(401).json({ success: false, message: 'Usuario o clave incorrectos' });
    } catch (e) {
        console.error('Login Error:', e);
        res.status(500).json({ error: 'Error del servidor: ' + e.message });
    }
});

// PRODUCTOS
app.get('/api/productos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) return res.json(await Producto.find());
        res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'database.json'), 'utf8')));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/productos', async (req, res) => {
    const p = req.body;
    try {
        if (mongoose.connection.readyState === 1) {
            if (p._id) await Producto.findByIdAndUpdate(p._id, p);
            else await new Producto(p).save();
            return res.json({ success: true });
        }
        let prod = JSON.parse(fs.readFileSync(path.join(__dirname, 'database.json'), 'utf8'));
        const idx = prod.findIndex(x => x.codigo === p.codigo);
        if (idx !== -1) prod[idx] = p; else prod.push(p);
        fs.writeFileSync(path.join(__dirname, 'database.json'), JSON.stringify(prod, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            if (mongoose.Types.ObjectId.isValid(req.params.id)) await Producto.findByIdAndDelete(req.params.id);
            else await Producto.findOneAndDelete({ codigo: req.params.id });
            return res.json({ success: true });
        }
        let prod = JSON.parse(fs.readFileSync(path.join(__dirname, 'database.json'), 'utf8'));
        prod = prod.filter(x => x.codigo !== req.params.id);
        fs.writeFileSync(path.join(__dirname, 'database.json'), JSON.stringify(prod, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// CONFIGURACIÓN
app.get('/api/config', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const conf = await Configuracion.findOne();
            if (conf) return res.json(conf);
        }
        res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/config', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Configuracion.deleteMany({});
            await new Configuracion(req.body).save();
            return res.json({ success: true });
        }
        fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// USUARIOS
app.get('/api/usuarios', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) return res.json(await Usuario.find());
        res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'usuarios.json'), 'utf8')));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/usuarios', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            // Reemplaza todos los usuarios con la nueva lista
            await Usuario.deleteMany({});
            await Usuario.insertMany(req.body);
            return res.json({ success: true });
        }
        fs.writeFileSync(path.join(__dirname, 'usuarios.json'), JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PEDIDOS (VENTAS)
app.get('/api/pedidos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) return res.json(await Pedido.find());
        res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'pedidos.json'), 'utf8')));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pedidos', async (req, res) => {
    const pedido = req.body;
    try {
        if (mongoose.connection.readyState === 1) {
            await new Pedido(pedido).save();
            for (const item of pedido.items) {
                await Producto.findOneAndUpdate(
                    { codigo: item.referencia },
                    { $inc: { existencia: -(parseInt(item.cantidad) || 0) } }
                );
            }
        }
        // Fallback/Log JSON
        const pPath = path.join(__dirname, 'pedidos.json');
        let d = JSON.parse(fs.readFileSync(pPath, 'utf8'));
        d.push(pedido);
        fs.writeFileSync(pPath, JSON.stringify(d, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// REPORTES
app.get('/api/reportes', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) return res.json(await Reporte.find());
        res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'reportes.json'), 'utf8')));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reportes', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            // En reportes solemos guardar el historial completo
            await Reporte.deleteMany({});
            await Reporte.insertMany(req.body);
            return res.json({ success: true });
        }
        fs.writeFileSync(path.join(__dirname, 'reportes.json'), JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// INGRESOS
app.get('/api/ingresos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) return res.json(await Ingreso.find());
        res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'ingresos.json'), 'utf8')));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ingresos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Ingreso.deleteMany({});
            await Ingreso.insertMany(req.body);
            return res.json({ success: true });
        }
        fs.writeFileSync(path.join(__dirname, 'ingresos.json'), JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// EGRESOS
app.get('/api/egresos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) return res.json(await Egreso.find());
        res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'egresos.json'), 'utf8')));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/egresos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Egreso.deleteMany({});
            await Egreso.insertMany(req.body);
            return res.json({ success: true });
        }
        fs.writeFileSync(path.join(__dirname, 'egresos.json'), JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// RESET SYSTEM
app.post('/api/reset-system', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Pedido.deleteMany({});
            await Reporte.deleteMany({});
            await Ingreso.deleteMany({});
            await Egreso.deleteMany({});
        }
        const files = ['ingresos.json', 'egresos.json', 'pedidos.json', 'reportes.json'];
        files.forEach(f => fs.writeFileSync(path.join(__dirname, f), JSON.stringify([], null, 2)));
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
