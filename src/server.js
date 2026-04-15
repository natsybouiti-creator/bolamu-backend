require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./config/db');
const cors = require('cors');
const app = express();

// ============================================================
// 1. MIDDLEWARES & CORS CONFIGURATION
// ============================================================
// Configuration CORS élargie pour autoriser les requêtes du Dashboard
app.use(cors({
    origin: '*', // Autorise toutes les sources pour le debug (à restreindre plus tard)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// LOGGER DE DEBUG : Affiche chaque requête dans les logs de Render
app.use((req, res, next) => {
    const now = new Date().toISOString();
    console.log(`[${now}] ${req.method} ${req.url}`);
    
    // Vérification de la présence du Token JWT pour le Dashboard
    if (req.headers.authorization) {
        console.log(`   -> Auth Header: Présent`);
    } else {
        console.log(`   -> Auth Header: MANQUANT`);
    }
    
    res.setHeader('X-Powered-By', 'Bolamu');
    next();
});

// Servir les fichiers statiques (images, css, js du dossier public)
app.use(express.static(path.join(process.cwd(), 'public')));

// ============================================================
// 2. IMPORT DES ROUTES
// ============================================================
const authRoutes         = require('./routes/auth.routes');
const patientRoutes      = require('./routes/patient.routes');
const doctorRoutes       = require('./routes/doctor.routes');
const appointmentRoutes  = require('./routes/appointment.routes');
const paymentRoutes       = require('./routes/payment.routes');
const prescriptionRoutes = require('./routes/prescription.routes');
const pharmacieRoutes    = require('./routes/pharmacie.routes');
const laboratoireRoutes  = require('./routes/laboratoire.routes');
const adminRoutes        = require('./routes/admin.routes');
const creditsRoutes      = require('./routes/credits.routes');
const momoRoutes         = require('./routes/momo.routes');
const telemedicineRoutes = require('./routes/telemedicine.routes');

// ============================================================
// 3. ROUTES API (V1)
// ============================================================
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/patients',      patientRoutes);
app.use('/api/v1/doctors',       doctorRoutes);
app.use('/api/v1/appointments',  appointmentRoutes);
app.use('/api/v1/payments',      paymentRoutes);
app.use('/api/v1/payments/momo', momoRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);
app.use('/api/v1/pharmacies',    pharmacieRoutes);
app.use('/api/v1/laboratories',  laboratoireRoutes);
app.use('/api/v1/admin',         adminRoutes);
app.use('/api/v1/articles',      require('./routes/articles.routes'));
app.use('/api/v1/credits',       creditsRoutes);
app.use('/api/v1/telemedicine',  telemedicineRoutes);

// ============================================================
// 4. ROUTES WEB
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// ============================================================
// 5. TEST CLOUD (NEON)
// ============================================================
app.get('/api/v1/test', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() as cloud_time');
        res.json({ 
            success: true, 
            message: '🚀 Connecté au Cloud Neon', 
            time: result.rows[0].cloud_time 
        });
    } catch (err) {
        console.error('[DATABASE ERROR]', err.message);
        res.status(500).json({ 
            success: false, 
            message: 'Erreur connexion Cloud', 
            error: err.message 
        });
    }
});

// ============================================================
// 6. ROUTE 404
// ============================================================
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route introuvable' });
});

// ============================================================
// 7. GESTION ERREUR GLOBALE
// ============================================================
app.use((err, req, res, next) => {
    console.error('[GLOBAL ERROR]', err);
    res.status(500).json({ success: false, message: 'Erreur interne serveur' });
});

// ============================================================
// 8. LANCEMENT SERVEUR
// ============================================================
// Render utilise souvent le port 10000 par défaut, 
// mais il faut impérativement utiliser process.env.PORT
const PORT = process.env.PORT || 3005;

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Bolamu server running on port ${PORT}`);
});

// Gestion du timeout pour Render
server.keepAliveTimeout = 120 * 1000; 
server.headersTimeout = 125 * 1000;

// Test de connexion DB après le lancement du serveur
async function checkDB() {
    try {
        await pool.query('SELECT 1');
        console.log('📡 Connecté à Neon DB');
    } catch (err) {
        console.error('❌ Connexion Neon échouée:', err.message);
    }
}
checkDB();