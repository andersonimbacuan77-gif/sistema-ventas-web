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
        .then(() => console.log('Conectado a MongoDB Atlas'))
        .catch(err => console.error('Error al conectar a MongoDB:', err));
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

// --- RUTAS API ---

// 1. Productos - Obtener todos
app.get('/api/productos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const productos = await Producto.find();
            res.json(productos);
        } else {
            const dbPath = path.join(__dirname, 'database.json');
            const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
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
            let productos = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            // Lógica simple de actualización para JSON
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
            const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            config = { ...config, ...data };
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
app.get('/api/usuarios', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const users = await Usuario.find();
            res.json(users);
        } else {
            const usersPath = path.join(__dirname, 'usuarios.json');
            if (fs.existsSync(usersPath)) {
                const data = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                res.json(Array.isArray(data) ? data : []);
            } else {
                res.json([]);
            }
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

app.post('/api/usuarios', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            // Sincronizar array de usuarios con MongoDB
            const users = req.body;
            for (const u of users) {
                await Usuario.findOneAndUpdate({ user: u.user }, u, { upsert: true });
            }
            res.json({ success: true });
        } else {
            const usersPath = path.join(__dirname, 'usuarios.json');
            fs.writeFileSync(usersPath, JSON.stringify(req.body, null, 2));
            res.json({ success: true });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar usuarios' });
    }
});

app.post('/api/login', async (req, res) => {
    const { user, pass } = req.body;
    try {
        let cuenta = null;
        if (mongoose.connection.readyState === 1) {
            cuenta = await Usuario.findOne({ user, pass });
        }
        
        if (!cuenta) {
            const pathUsuarios = path.join(__dirname, 'usuarios.json');
            if (fs.existsSync(pathUsuarios)) {
                const usuarios = JSON.parse(fs.readFileSync(pathUsuarios, 'utf8'));
                cuenta = usuarios.find(u => u.user === user && u.pass === pass);
            }
        }
        
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
app.get('/api/pedidos', (req, res) => {
    try {
        const pedidosPath = path.join(__dirname, 'pedidos.json');
        if (fs.existsSync(pedidosPath)) {
            const data = JSON.parse(fs.readFileSync(pedidosPath, 'utf8'));
            res.json(data);
        } else {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener pedidos' });
    }
});

// 7. Pedidos - Guardar uno nuevo
app.post('/api/pedidos', async (req, res) => {
    const pedido = req.body;
    try {
        const pedidosPath = path.join(__dirname, 'pedidos.json');
        let pedidos = [];
        if (fs.existsSync(pedidosPath)) {
            pedidos = JSON.parse(fs.readFileSync(pedidosPath, 'utf8'));
        }
        pedidos.push(pedido);
        fs.writeFileSync(pedidosPath, JSON.stringify(pedidos, null, 2));

        // Actualizar existencias de productos si es necesario
        const dbPath = path.join(__dirname, 'database.json');
        if (fs.existsSync(dbPath)) {
            let productos = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            pedido.items.forEach(item => {
                const prod = productos.find(p => p.codigo === item.referencia);
                if (prod) {
                    prod.existencia = (parseInt(prod.existencia) || 0) - (parseInt(item.cantidad) || 0);
                }
            });
            fs.writeFileSync(dbPath, JSON.stringify(productos, null, 2));
        }

        // Si se usa MongoDB, también actualizar allí
        if (mongoose.connection.readyState === 1) {
            for (const item of pedido.items) {
                await Producto.findOneAndUpdate(
                    { codigo: item.referencia },
                    { $inc: { existencia: -(parseInt(item.cantidad) || 0) } }
                );
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar pedido' });
    }
});

// 8. Historial de Reportes
app.get('/api/reportes', (req, res) => {
    try {
        const repoPath = path.join(__dirname, 'reportes.json');
        if (fs.existsSync(repoPath)) {
            const data = JSON.parse(fs.readFileSync(repoPath, 'utf8'));
            res.json(data);
        } else {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener reportes' });
    }
});

app.post('/api/reportes', (req, res) => {
    try {
        const repoPath = path.join(__dirname, 'reportes.json');
        fs.writeFileSync(repoPath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar reportes' });
    }
});

app.delete('/api/reportes/:id', (req, res) => {
    try {
        const repoPath = path.join(__dirname, 'reportes.json');
        if (fs.existsSync(repoPath)) {
            let data = JSON.parse(fs.readFileSync(repoPath, 'utf8'));
            const idToRemove = parseInt(req.params.id);
            data = data.filter(r => r.idReporte !== idToRemove);
            fs.writeFileSync(repoPath, JSON.stringify(data, null, 2));
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'No hay reportes' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar reporte' });
    }
});

// 9. Ingresos
app.get('/api/ingresos', (req, res) => {
    try {
        const p = path.join(__dirname, 'ingresos.json');
        if (fs.existsSync(p)) {
            res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
        } else {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener ingresos' });
    }
});

app.post('/api/ingresos', (req, res) => {
    try {
        const p = path.join(__dirname, 'ingresos.json');
        fs.writeFileSync(p, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar ingresos' });
    }
});

// 10. Egresos
app.get('/api/egresos', (req, res) => {
    try {
        const p = path.join(__dirname, 'egresos.json');
        if (fs.existsSync(p)) {
            res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
        } else {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener egresos' });
    }
});

app.post('/api/egresos', (req, res) => {
    try {
        const p = path.join(__dirname, 'egresos.json');
        fs.writeFileSync(p, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar egresos' });
    }
});

// 11. Reiniciar Sistema (Borrar Todo)
app.post('/api/reset-system', (req, res) => {
    try {
        const files = ['database.json', 'ingresos.json', 'egresos.json', 'pedidos.json', 'reportes.json'];
        files.forEach(f => {
            const p = path.join(__dirname, f);
            if (fs.existsSync(p)) {
                fs.writeFileSync(p, JSON.stringify([], null, 2));
            }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al reiniciar sistema' });
    }
});

// Iniciamos el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
