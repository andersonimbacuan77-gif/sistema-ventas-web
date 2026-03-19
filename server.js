const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.use(express.static(path.join(__dirname)));

const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI) {
    mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => console.log('Conectado a MongoDB Atlas'))
        .catch(err => console.error('Error al conectar a MongoDB:', err));
} else {
    console.log('ADVERTENCIA: No hay MONGO_URI en .env. Usando archivos JSON locales como respaldo.');
}

// Modelos Dinámicos Mongoose (strict: false permite guardar cualquier objeto sin schema rígido)
const genSchema = new mongoose.Schema({}, { strict: false, id: false });
const Producto = mongoose.models.Producto || mongoose.model('Producto', genSchema, 'productos');
const Configuracion = mongoose.models.Configuracion || mongoose.model('Configuracion', genSchema, 'configuracion');
const Usuario = mongoose.models.Usuario || mongoose.model('Usuario', genSchema, 'usuarios');
const Pedido = mongoose.models.Pedido || mongoose.model('Pedido', genSchema, 'pedidos');
const Reporte = mongoose.models.Reporte || mongoose.model('Reporte', genSchema, 'reportes');
const Ingreso = mongoose.models.Ingreso || mongoose.model('Ingreso', genSchema, 'ingresos');
const Egreso = mongoose.models.Egreso || mongoose.model('Egreso', genSchema, 'egresos');

// --- RUTAS API ---

// 1. Productos
app.get('/api/productos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            const data = await Producto.find().lean();
            res.json(data);
        } else {
            const dbPath = path.join(__dirname, 'database.json');
            res.json(fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : []);
        }
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/productos', async (req, res) => {
    const p = req.body;
    try {
        if (mongoose.connection.readyState === 1) {
            if (p._id) await Producto.findByIdAndUpdate(p._id, p);
            else await Producto.create(p);
            res.json({ success: true });
        } else {
            const dbPath = path.join(__dirname, 'database.json');
            let prod = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : [];
            const idx = prod.findIndex(x => x.codigo === p.codigo);
            if (idx !== -1) prod[idx] = p; else prod.push(p);
            fs.writeFileSync(dbPath, JSON.stringify(prod, null, 2));
            res.json({ success: true });
        }
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/productos/:id', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Producto.findByIdAndDelete(req.params.id);
        } else {
            const dbPath = path.join(__dirname, 'database.json');
            let p = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : [];
            p = p.filter(x => x.codigo !== req.params.id);
            fs.writeFileSync(dbPath, JSON.stringify(p, null, 2));
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// 2. Configuración
app.get('/api/config', async (req, res) => {
    try {
        let config = { categorias: [], unidades: [], empresa: {} };
        if (mongoose.connection.readyState === 1) {
            const data = await Configuracion.findOne().lean();
            if (data) config = { ...config, ...data };
        } else {
            const p = path.join(__dirname, 'config.json');
            if (fs.existsSync(p)) config = { ...config, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
        }
        res.json(config);
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/config', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Configuracion.deleteMany({});
            await Configuracion.create(req.body);
        } else {
            fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(req.body, null, 2));
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// 3. Usuarios
app.get('/api/usuarios', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            res.json(await Usuario.find().lean());
        } else {
            const p = path.join(__dirname, 'usuarios.json');
            res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
        }
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/usuarios', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Usuario.deleteMany({});
            await Usuario.insertMany(req.body);
        } else {
            fs.writeFileSync(path.join(__dirname, 'usuarios.json'), JSON.stringify(req.body, null, 2));
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/login', async (req, res) => {
    const { user, pass } = req.body;
    try {
        let cuenta;
        if (mongoose.connection.readyState === 1) {
            cuenta = await Usuario.findOne({ user, pass }).lean();
        } else {
            const p = path.join(__dirname, 'usuarios.json');
            const data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
            cuenta = data.find(u => u.user === user && u.pass === pass);
        }
        if (cuenta) res.json({ success: true, user: cuenta });
        else res.status(401).json({ success: false, message: 'Usuario o clave incorrectos' });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// 4. Pedidos
app.get('/api/pedidos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) res.json(await Pedido.find().lean());
        else {
            const p = path.join(__dirname, 'pedidos.json');
            res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
        }
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/pedidos', async (req, res) => {
    const pedido = req.body;
    try {
        if (mongoose.connection.readyState === 1) {
            await Pedido.create(pedido);
            for (const item of pedido.items) {
                await Producto.findOneAndUpdate({ codigo: item.referencia }, { $inc: { existencia: -(parseInt(item.cantidad) || 0) } });
            }
        } else {
            const p = path.join(__dirname, 'pedidos.json');
            let data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
            data.push(pedido);
            fs.writeFileSync(p, JSON.stringify(data, null, 2));
            const dbPath = path.join(__dirname, 'database.json');
            if (fs.existsSync(dbPath)) {
                let pList = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
                pedido.items.forEach(i => {
                    const found = pList.find(x => x.codigo === i.referencia);
                    if (found) found.existencia = (parseInt(found.existencia)||0) - (parseInt(i.cantidad)||0);
                });
                fs.writeFileSync(dbPath, JSON.stringify(pList, null, 2));
            }
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// 5. Reportes
app.get('/api/reportes', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) res.json(await Reporte.find().lean());
        else {
            const p = path.join(__dirname, 'reportes.json');
            res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
        }
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/reportes', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Reporte.deleteMany({});
            await Reporte.insertMany(req.body);
        } else {
            fs.writeFileSync(path.join(__dirname, 'reportes.json'), JSON.stringify(req.body, null, 2));
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.delete('/api/reportes/:id', async (req, res) => {
    try {
        const idToRemove = parseInt(req.params.id);
        if (mongoose.connection.readyState === 1) {
            await Reporte.deleteOne({ idReporte: idToRemove });
        } else {
            const p = path.join(__dirname, 'reportes.json');
            let data = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
            fs.writeFileSync(p, JSON.stringify(data.filter(r => r.idReporte !== idToRemove), null, 2));
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// 6. Ingresos
app.get('/api/ingresos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) res.json(await Ingreso.find().lean());
        else {
            const p = path.join(__dirname, 'ingresos.json');
            res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
        }
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/ingresos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Ingreso.deleteMany({});
            await Ingreso.insertMany(req.body);
        } else {
            fs.writeFileSync(path.join(__dirname, 'ingresos.json'), JSON.stringify(req.body, null, 2));
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// 7. Egresos
app.get('/api/egresos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) res.json(await Egreso.find().lean());
        else {
            const p = path.join(__dirname, 'egresos.json');
            res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
        }
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.post('/api/egresos', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Egreso.deleteMany({});
            await Egreso.insertMany(req.body);
        } else {
            fs.writeFileSync(path.join(__dirname, 'egresos.json'), JSON.stringify(req.body, null, 2));
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// Reiniciar Sistema
app.post('/api/reset-system', async (req, res) => {
    try {
        if (mongoose.connection.readyState === 1) {
            await Promise.all([
                Producto.deleteMany({}),
                Pedido.deleteMany({}),
                Reporte.deleteMany({}),
                Ingreso.deleteMany({}),
                Egreso.deleteMany({})
            ]);
        }
        const files = ['database.json', 'ingresos.json', 'egresos.json', 'pedidos.json', 'reportes.json'];
        files.forEach(f => {
            const p = path.join(__dirname, f);
            if (fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify([], null, 2));
        });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
});

app.listen(PORT, () => console.log(`Servidor corriendo en el puerto ${PORT}`));
