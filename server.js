require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// --- MODELOS DE DATOS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullname: String,
    role: { type: String, default: 'user' },
    nit: String,
    phone: String,
    dept: String,
    city: String,
    address: String
}, { strict: false });

const ProductSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    nombre: String,
    categoria: String,
    precio: Number,
    costo: Number,
    desc: String,
    fotos: [String],
    stock: mongoose.Schema.Types.Mixed
}, { strict: false });

const SaleSchema = new mongoose.Schema({
    id: String,
    fecha: String,
    cliente: mongoose.Schema.Types.Mixed,
    items: [mongoose.Schema.Types.Mixed],
    total: Number,
    metodoPago: String,
    estado: { type: String, default: 'pendiente' }
}, { strict: false });

const ReportSchema = new mongoose.Schema({
    id: String,
    fecha: String,
    data: mongoose.Schema.Types.Mixed
}, { strict: false });

const ConfigSchema = new mongoose.Schema({
    key: { type: String, default: 'global' },
    company: mongoose.Schema.Types.Mixed,
    payments: [mongoose.Schema.Types.Mixed]
}, { strict: false });

const User = mongoose.model('User', UserSchema);
const Product = mongoose.model('Product', ProductSchema);
const Sale = mongoose.model('Sale', SaleSchema);
const Report = mongoose.model('Report', ReportSchema);
const Config = mongoose.model('Config', ConfigSchema);

const MODEL_MAP = {
    'users.json': User,
    'products.json': Product,
    'sales.json': Sale,
    'reports.json': Report,
    'config.json': Config
};

// --- LÓGICA DE API (COMPATIBILIDAD CON FRONT-END) ---
app.get('/api/data/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const Model = MODEL_MAP[filename];
        
        if (!Model) return res.json(null);
        
        if (filename === 'config.json') {
            const config = await Model.findOne({ key: 'global' });
            return res.json(config || {});
        }
        
        if (filename === 'session.json') {
            // Manejo de sesión efímera si es necesario, por ahora simulamos
            return res.json({});
        }

        const data = await Model.find({});
        // Asegurar que cada objeto tenga un 'id' legible para el front (Fase 47)
        const formattedData = data.map(item => {
            const obj = item.toObject();
            if (!obj.id && obj._id) obj.id = String(obj._id);
            return obj;
        });
        res.json(formattedData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/data/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const body = req.body;
        const Model = MODEL_MAP[filename];

        if (!Model) return res.json({ success: false });

        if (filename === 'config.json') {
            await Model.findOneAndUpdate({ key: 'global' }, body, { upsert: true });
        } else if (filename === 'users.json' || filename === 'products.json') {
            // Manejo especial para arrays de objetos con ID
            const items = Array.isArray(body) ? body : [body];
            for (const item of items) {
                const idField = filename === 'users.json' ? 'username' : 'id';
                await Model.findOneAndUpdate({ [idField]: item[idField] }, item, { upsert: true });
            }
        } else if (filename === 'reports.json') {
            // REPORTES: Insert/update individual por 'id' — NUNCA borra los existentes
            // Esto garantiza que los reportes son una copia de seguridad permanente e independiente
            const items = Array.isArray(body) ? body : [body];
            for (const item of items) {
                if (item.id) {
                    await Model.findOneAndUpdate({ id: item.id }, item, { upsert: true });
                }
            }
        } else {
            // Para ventas (histórico) — se insertan como documentos individuales
            if (Array.isArray(body)) {
                await Model.deleteMany({});
                await Model.insertMany(body);
            } else {
                await Model.create(body);
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/data/:filename/:id', async (req, res) => {
    try {
        const { filename, id } = req.params;
        const Model = MODEL_MAP[filename];
        if (!Model) return res.status(404).json({ success: false, error: 'Colección no encontrada' });

        const idField = filename === 'users.json' ? 'username' : 'id';
        const result = await Model.deleteOne({ [idField]: id });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, error: 'Registro no encontrado' });
        }
        
        res.json({ success: true, message: `Registro ${id} eliminado de ${filename}` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/data/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const Model = MODEL_MAP[filename];
        if (!Model) return res.status(404).json({ success: false, error: 'Colección no encontrada' });

        await Model.deleteMany({});
        res.json({ success: true, message: `Todos los registros de ${filename} han sido eliminados` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- MIGRACIÓN AUTOMÁTICA Y CREACIÓN DE "TABLAS" ---
async function initDatabase() {
    try {
        const userCount = await User.countDocuments();
        if (userCount === 0) {
            console.log('📦 Base de datos vacía. Iniciando migración automática...');
            
            // Intentar cargar desde archivos locales si existen
            const dataFiles = ['users.json', 'products.json', 'config.json', 'reports.json', 'sales.json'];
            for (const file of dataFiles) {
                const filePath = path.join(__dirname, 'data', file);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const data = JSON.parse(content);
                    const Model = MODEL_MAP[file];
                    
                    if (file === 'config.json') {
                        await Model.create({ ...data, key: 'global' });
                    } else if (Array.isArray(data)) {
                        await Model.insertMany(data);
                    }
                    console.log(`✅ Migrado: ${file}`);
                }
            }
            
            // Si no hay usuarios en el archivo tampoco, crear admin por defecto
            const finalUserCount = await User.countDocuments();
            if (finalUserCount === 0) {
                await User.create({
                    username: 'admin',
                    password: '123',
                    fullname: 'Administrador Principal',
                    role: 'admin'
                });
                console.log('👤 Usuario admin por defecto creado.');
            }
        }
    } catch (err) {
        console.error('❌ Error en initDatabase:', err);
    }
}

// Servir login.html por defecto
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Conexión a MongoDB
if (!MONGODB_URI) {
    console.error('❌ ERROR FATAL: La variable de entorno MONGODB_URI no está definida.');
    console.error('👉 Asegúrate de haberla configurado en el panel de Render (Environment Variables).');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => {
        console.log('🔌 Conectado a MongoDB Atlas');
        initDatabase();
        app.listen(PORT, () => console.log(`🚀 Servidor en ejecución en puerto ${PORT}`));
    })
    .catch(err => {
        console.error('🔴 Error de conexión MongoDB:', err);
        process.exit(1);
    });
