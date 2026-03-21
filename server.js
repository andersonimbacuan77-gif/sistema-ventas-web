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

// --- MODELOS DE DATOS ---
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
const Producto = mongoose.models.Producto || mongoose.model('Producto', productoSchema, 'productos');

const usuarioSchema = new mongoose.Schema({
    nombre: String,
    user: { type: String, unique: true },
    pass: String,
    rol: { type: String, default: 'cliente' }
}, { strict: false });
const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema, 'usuarios');

const pedidoSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    fecha: String,
    hora: String,
    cliente: String,
    items: Array,
    total: Number,
    ganancia: Number
}, { strict: false });
const Pedido = mongoose.models.Pedido || mongoose.model('Pedido', pedidoSchema, 'pedidos');

const reporteSchema = new mongoose.Schema({
    idReporte: { type: Number, unique: true },
    fechaCreacion: String,
    admin: String,
    rango: Object,
    ventasRaw: Number,
    gananciaRaw: Number,
    cantidadPedidos: Number,
    pedidos: Array
}, { strict: false });
const Reporte = mongoose.models.Reporte || mongoose.model('Reporte', reporteSchema, 'reportes');

const ingresoSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    ref: String,
    fecha_registro: String,
    cantidad: Number
}, { strict: false });
const Ingreso = mongoose.models.Ingreso || mongoose.model('Ingreso', ingresoSchema, 'ingresos');

const egresoSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    ref: String,
    fecha_registro: String,
    cantidad: Number
}, { strict: false });
const Egreso = mongoose.models.Egreso || mongoose.model('Egreso', egresoSchema, 'egresos');

const configSchema = new mongoose.Schema({
    id: { type: String, default: 'main' },
    categorias: Array,
    unidades: Array,
    empresa: Object
}, { strict: false });
const Config = mongoose.models.Config || mongoose.model('Config', configSchema, 'configuracion');

// --- CONEXIÓN A MONGODB ---
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
    mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(async () => {
            console.log(`✅ Conectado a MongoDB Atlas`);
            
            // INICIALIZACIÓN: Crear administrador por defecto si no hay usuarios
            try {
                const userCount = await Usuario.countDocuments();
                if (userCount === 0) {
                    const defaultAdmin = new Usuario({
                        nombre: "Administrador Inicial",
                        user: "admin",
                        pass: "1234",
                        rol: "admin"
                    });
                    await defaultAdmin.save();
                    console.log("🚀 Base de datos nueva: Se ha creado el usuario 'admin' con clave '1234'");
                }

                const configCount = await Config.countDocuments();
                if (configCount === 0) {
                    const defaultConfig = new Config({
                        id: 'main',
                        categorias: ["General"],
                        unidades: ["Und", "Kg", "Lt"],
                        empresa: {
                            nombre: "Mi Nueva Empresa",
                            nit: "000-000",
                            telefono: "000000",
                            direccion: "Calle Falsa 123",
                            tema: "predefinido"
                        }
                    });
                    await defaultConfig.save();
                    console.log("⚙️ Configuración inicial creada.");
                }
            } catch (err) {
                console.error("Error al inicializar datos:", err);
            }
        })
        .catch(err => console.error('❌ Error al conectar a MongoDB:', err));
} else {
    console.log('ADVERTENCIA: No hay MONGO_URI en .env. Usando archivos JSON locales como respaldo.');
}


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

app.post('/api/register', async (req, res) => {
    const { nombre, user, pass } = req.body;
    try {
        const existe = await Usuario.findOne({ user });
        if (existe) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe' });
        }
        const nuevo = new Usuario({ nombre, user, pass, rol: 'cliente' });
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
        const pedidos = await Pedido.find().sort({ id: -1 });
        res.json(pedidos);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

// 7. Pedidos - Guardar uno nuevo
app.post('/api/pedidos', async (req, res) => {
    const p = req.body;
    try {
        if (!p.id) {
            return res.status(400).json({ error: 'Pedido sin ID' });
        }

        // 1. VALIDACIÓN PREVIA DE STOCK
        if (p.items && Array.isArray(p.items)) {
            for (const item of p.items) {
                if (!item.referencia) continue;
                const prod = await Producto.findOne({ codigo: item.referencia });
                if (!prod) {
                    return res.status(400).json({ error: `Producto no encontrado: ${item.referencia}` });
                }
                
                const stockDisponible = Number(prod.existencia) || 0;
                const cantidadPedida = Number(item.cantidad) || 0;

                if (stockDisponible < cantidadPedida) {
                    console.warn(`[STOCK ERROR] Producto: ${prod.nombre}, Disponible: ${stockDisponible}, Pedido: ${cantidadPedida}`);
                    return res.status(400).json({ 
                        error: `Stock insuficiente para ${prod.nombre}. Disponible: ${stockDisponible}, Pedido: ${cantidadPedida}` 
                    });
                }
            }
        }

        // 2. GUARDAR PEDIDO
        await Pedido.findOneAndUpdate({ id: p.id }, p, { upsert: true });

        // 3. ACTUALIZAR EXISTENCIAS
        if (p.items && Array.isArray(p.items)) {
            for (const item of p.items) {
                if (!item.referencia) continue;
                await Producto.findOneAndUpdate(
                    { codigo: item.referencia },
                    { $inc: { existencia: -(parseInt(item.cantidad) || 0) } }
                );
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ error: 'Error al guardar pedido' });
    }
});

app.delete('/api/pedidos/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const pedido = await Pedido.findOne({ id });
        if (!pedido) {
            return res.status(404).json({ error: 'Pedido no encontrado' });
        }

        // DEVOLVER EXISTENCIAS AL INVENTARIO
        if (pedido.items && Array.isArray(pedido.items)) {
            for (const item of pedido.items) {
                await Producto.findOneAndUpdate(
                    { codigo: item.referencia },
                    { $inc: { existencia: (parseInt(item.cantidad) || 0) } }
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

app.post('/api/delete-all-reportes', async (req, res) => {
    try {
        await Reporte.deleteMany({});
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar todo el historial' });
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
        if (Array.isArray(data)) {
            // Sincronización masiva basada en 'id'
            for (const r of data) {
                if (!r.id) continue;
                await Ingreso.findOneAndUpdate({ id: r.id }, r, { upsert: true });
            }
        } else if (data.id) {
            await Ingreso.findOneAndUpdate({ id: data.id }, data, { upsert: true });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving ingresos:', error);
        res.status(500).json({ error: 'Error al guardar ingresos' });
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
        if (Array.isArray(data)) {
            for (const r of data) {
                if (!r.id) continue;
                await Egreso.findOneAndUpdate({ id: r.id }, r, { upsert: true });
            }
        } else if (data.id) {
            await Egreso.findOneAndUpdate({ id: data.id }, data, { upsert: true });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving egresos:', error);
        res.status(500).json({ error: 'Error al guardar egresos' });
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

// Iniciamos el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
