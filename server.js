const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
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

// Conexión a MongoDB (Opcional por ahora para que no falle si no hay URI)
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
    mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(async () => {
            const dbName = mongoose.connection.name;
            console.log(`✅ Conectado a MongoDB Atlas - Base de datos: ${dbName}`);
            
            // Log de conteo para depuración
            const pedCount = await mongoose.connection.db.collection('pedidos').countDocuments();
            const repCount = await mongoose.connection.db.collection('reportes').countDocuments();
            const proCount = await mongoose.connection.db.collection('productos').countDocuments();
            console.log(`📊 Estado inicial: Pedidos: ${pedCount}, Reportes: ${repCount}, Productos: ${proCount}`);
        })
        .catch(err => console.error('❌ Error al conectar a MongoDB:', err));
} else {
    console.log('ADVERTENCIA: No hay MONGO_URI en .env. Usando archivos JSON locales como respaldo.');
}

// Modelos (Placeholder para esquemas de Mongoose)
const productoSchema = new mongoose.Schema({
    nombre: String,
    categoria: String,
    unidad: String,
    codigo: { type: String, unique: true },
    precioCompra: Number,
    margen: Number,
    precio: Number,
    existencia: { type: Number, default: 0 },
    imagen: String
});

const Producto = mongoose.models.Producto || mongoose.model('Producto', productoSchema);

const usuarioSchema = new mongoose.Schema({
    nombre: String,
    user: { type: String, unique: true },
    pass: String,
    rol: { type: String, default: 'cliente' },
    canEditPrice: { type: Boolean, default: false },
    permExcel: { type: Boolean, default: false },
    permPrint: { type: Boolean, default: false },
    permTicket: { type: Boolean, default: false },
    permWA: { type: Boolean, default: false }
});

const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema);

const pedidoSchema = new mongoose.Schema({
    id: Number,
    fecha: String,
    hora: String,
    cliente: String,
    items: Array,
    total: Number,
    ganancia: Number
});
const Pedido = mongoose.models.Pedido || mongoose.model('Pedido', pedidoSchema);

const reporteSchema = new mongoose.Schema({
    idReporte: Number,
    fechaCreacion: String,
    admin: String,
    rango: Object,
    ventasRaw: Number,
    gananciaRaw: Number,
    cantidadPedidos: Number,
    pedidos: Array
});
const Reporte = mongoose.models.Reporte || mongoose.model('Reporte', reporteSchema);

const ingresoSchema = new mongoose.Schema({
    fecha: String,
    registros: Array
});
const Ingreso = mongoose.models.Ingreso || mongoose.model('Ingreso', ingresoSchema);

const egresoSchema = new mongoose.Schema({
    fecha: String,
    registros: Array
});
const Egreso = mongoose.models.Egreso || mongoose.model('Egreso', egresoSchema);

const configSchema = new mongoose.Schema({
    id: { type: String, default: 'main' },
    categorias: Array,
    unidades: Array,
    empresa: Object
});
const Config = mongoose.models.Config || mongoose.model('Config', configSchema);

// --- RUTAS API ---

// Middleware para verificar conexión a BD
const checkDB = (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ error: 'Base de datos no conectada. Reintente en unos momentos.' });
    }
    next();
};

app.use('/api', checkDB);

// 1. Productos - Obtener todos
app.get('/api/productos', async (req, res) => {
    try {
        const productos = await Producto.find();
        res.json(productos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// 2. Productos - Guardar/Actualizar
app.post('/api/productos', async (req, res) => {
    const p = req.body;
    try {
        if (p._id) {
            await Producto.findByIdAndUpdate(p._id, p);
        } else {
            const nuevo = new Producto(p);
            await nuevo.save();
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar producto' });
    }
});

// 3. Configuración
app.get('/api/config', async (req, res) => {
    try {
        let config = await Config.findOne({ id: 'main' });
        if (!config) {
            config = { id: 'main', categorias: [], unidades: [], empresa: {} };
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

app.post('/api/config', async (req, res) => {
    try {
        await Config.findOneAndUpdate({ id: 'main' }, req.body, { upsert: true });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar configuración' });
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
        for (const u of users) {
            await Usuario.findOneAndUpdate({ user: u.user }, u, { upsert: true });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar usuarios' });
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

// 5. Eliminar Producto
app.delete('/api/productos/:id', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Producto.findByIdAndDelete(req.params.id);
        } else {
            const dbPath = path.join(__dirname, 'database.json');
            let productos = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            // En JSON usamos el índice como ID temporal o el código
            productos = productos.filter(p => p.codigo !== req.params.id);
            fs.writeFileSync(dbPath, JSON.stringify(productos, null, 2));
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// 6. Pedidos - Obtener todos
app.get('/api/pedidos', async (req, res) => {
    try {
        const pedidos = await Pedido.find();
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

// 7. Pedidos - Guardar uno nuevo
app.post('/api/pedidos', async (req, res) => {
    const p = req.body;
    try {
        const nuevo = new Pedido(p);
        await nuevo.save();

        // Actualizar existencias de productos en MongoDB
        for (const item of p.items) {
            await Producto.findOneAndUpdate(
                { codigo: item.referencia },
                { $inc: { existencia: -(parseInt(item.cantidad) || 0) } }
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ error: 'Error al guardar pedido' });
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
        const reportes = req.body; // Viene como un array según cliente.html/admin.html
        if (Array.isArray(reportes)) {
            for (const r of reportes) {
                await Reporte.findOneAndUpdate({ idReporte: r.idReporte }, r, { upsert: true });
            }
        } else {
            await Reporte.findOneAndUpdate({ idReporte: reportes.idReporte }, reportes, { upsert: true });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar reportes' });
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
        const data = req.body; // Array de registros por día
        if (Array.isArray(data)) {
            for (const r of data) {
                await Ingreso.findOneAndUpdate(
                    { fecha: r.fecha },
                    r,
                    { upsert: true }
                );
            }
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar ingresos' });
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
        if (Array.isArray(data)) {
            for (const r of data) {
                await Egreso.findOneAndUpdate(
                    { fecha: r.fecha },
                    r,
                    { upsert: true }
                );
            }
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar egresos' });
    }
});

// 11. Reiniciar Sistema (Borrar Todo en MongoDB)
app.post('/api/reset-system', async (req, res) => {
    try {
        await Producto.deleteMany({});
        await Pedido.deleteMany({});
        await Reporte.deleteMany({});
        await Ingreso.deleteMany({});
        await Egreso.deleteMany({});
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al reiniciar sistema' });
    }
});

// Iniciamos el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
