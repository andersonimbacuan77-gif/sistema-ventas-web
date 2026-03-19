const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// 1. INICIALIZAR APP (Esto faltaba ponerlo al principio)
const app = express();

// 2. CONFIGURACIÓN DE PUERTO PARA RENDER
const PORT = process.env.PORT || 10000;

// 3. MIDDLEWARE
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Redirigir la raíz al login
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.use(express.static(path.join(__dirname)));

// 4. CONEXIÓN A MONGODB
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
    mongoose.connect(MONGO_URI)
        .then(() => console.log('Conectado a MongoDB Atlas'))
        .catch(err => console.error('Error al conectar a MongoDB:', err));
} else {
    console.log('ADVERTENCIA: No hay MONGO_URI. Usando JSON locales.');
}

// Modelos
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

// --- RUTAS API ---

// 1. Productos - Obtener todos
app.get('/api/productos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const productos = await Producto.find();
            res.json(productos);
        } else {
            const dbPath = path.join(__dirname, 'database.json');
            const data = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : [];
            res.json(data);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

// 2. Productos - Guardar/Actualizar
app.post('/api/productos', async (req, res) => {
    const p = req.body;
    try {
        if (mongoose.connection.readyState === 1) {
            if (p._id) {
                await Producto.findByIdAndUpdate(p._id, p);
            } else {
                const nuevo = new Producto(p);
                await nuevo.save();
            }
            res.json({ success: true });
        } else {
            const dbPath = path.join(__dirname, 'database.json');
            let productos = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : [];
            const idx = productos.findIndex(prod => prod.codigo === p.codigo);
            if (idx !== -1) productos[idx] = p;
            else productos.push(p);
            fs.writeFileSync(dbPath, JSON.stringify(productos, null, 2));
            res.json({ success: true });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar producto' });
    }
});

// 3. Configuración
app.get('/api/config', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        let config = { categorias: [], unidades: [], empresa: {} };
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener configuración' });
    }
});

app.post('/api/config', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

// 4. Usuarios / Login
app.get('/api/usuarios', (req, res) => {
    try {
        const usersPath = path.join(__dirname, 'usuarios.json');
        const data = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, 'utf8')) : [];
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

app.post('/api/usuarios', (req, res) => {
    try {
        const usersPath = path.join(__dirname, 'usuarios.json');
        fs.writeFileSync(usersPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar usuarios' });
    }
});

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    try {
        const pathUsuarios = path.join(__dirname, 'usuarios.json');
        if (!fs.existsSync(pathUsuarios)) return res.status(401).json({ message: 'No hay usuarios registrados' });
        const usuarios = JSON.parse(fs.readFileSync(pathUsuarios, 'utf8'));
        const cuenta = usuarios.find(u => u.user === user && u.pass === pass);
        if (cuenta) res.json({ success: true, user: cuenta });
        else res.status(401).json({ success: false, message: 'Usuario o clave incorrectos' });
    } catch (error) {
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
            productos = productos.filter(p => p.codigo !== req.params.id);
            fs.writeFileSync(dbPath, JSON.stringify(productos, null, 2));
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

// 6. Pedidos
app.get('/api/pedidos', (req, res) => {
    try {
        const pedidosPath = path.join(__dirname, 'pedidos.json');
        const data = fs.existsSync(pedidosPath) ? JSON.parse(fs.readFileSync(pedidosPath, 'utf8')) : [];
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

app.post('/api/pedidos', async (req, res) => {
    const pedido = req.body;
    try {
        const pedidosPath = path.join(__dirname, 'pedidos.json');
        let pedidos = fs.existsSync(pedidosPath) ? JSON.parse(fs.readFileSync(pedidosPath, 'utf8')) : [];
        pedidos.push(pedido);
        fs.writeFileSync(pedidosPath, JSON.stringify(pedidos, null, 2));

        // Actualizar existencias
        const dbPath = path.join(__dirname, 'database.json');
        if (fs.existsSync(dbPath)) {
            let productos = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            pedido.items.forEach(item => {
                const prod = productos.find(p => p.codigo === item.referencia);
                if (prod) prod.existencia = (parseInt(prod.existencia) || 0) - (parseInt(item.cantidad) || 0);
            });
            fs.writeFileSync(dbPath, JSON.stringify(productos, null, 2));
        }

        if (mongoose.connection.readyState === 1) {
            for (const item of pedido.items) {
                await Producto.findOneAndUpdate({ codigo: item.referencia }, { $inc: { existencia: -(parseInt(item.cantidad) || 0) } });
            }
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar pedido' });
    }
});

// 7. Reportes, Ingresos, Egresos (Similares...)
app.get('/api/reportes', (req, res) => {
    const p = path.join(__dirname, 'reportes.json');
    res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
});
app.post('/api/reportes', (req, res) => {
    fs.writeFileSync(path.join(__dirname, 'reportes.json'), JSON.stringify(req.body, null, 2));
    res.json({ success: true });
});

// 8. FINAL: INICIAR EL SERVIDOR (Una sola vez)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log('Error: El puerto ya está en uso. Reintentando...');
    } else {
        console.error(err);
    }
});
