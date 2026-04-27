require('./instrument');
require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./config/db');
const cors = require('cors');
const Sentry = require('@sentry/node');
const app = express();
app.set('trust proxy', 1);

// ============================================================
// 1. MIDDLEWARES & CORS CONFIGURATION
// ============================================================
const allowedOrigins = [
    'https://bolamu-backend.onrender.com',
    'http://localhost:3000',
    'http://localhost:10000'
];

app.use(cors({
    origin: function(origin, callback) {
        // Autoriser les requêtes sans origin (Postman, mobile apps, curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Non autorisé par CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// LOGGER DE DEBUG : Affiche chaque requÃªte dans les logs de Render
app.use((req, res, next) => {
    const now = new Date().toISOString();
    console.log(`[${now}] ${req.method} ${req.url}`);
    
    // VÃ©rification de la prÃ©sence du Token JWT pour le Dashboard
    if (req.headers.authorization) {
        console.log(`   -> Auth Header: OK`);
    } else {
        console.log(`   -> Auth Header: MANQUANT`);
    }
    
    res.setHeader('X-Powered-By', 'Bolamu');
    next();
});

// Servir les fichiers statiques (images, css, js du dossier public)
app.use(express.static(path.join(process.cwd(), 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

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
const airtelRoutes       = require('./routes/airtel.routes');
const telemedicineRoutes = require('./routes/telemedicine.routes');
const qrRoutes = require('./routes/qr.routes');
const reportRoutes       = require('./routes/consultation-report.routes');
const labRoutes          = require('./routes/lab.routes');
const ratingsRoutes      = require('./routes/ratings.routes');
const payoutsRoutes      = require('./routes/payouts.routes');
const bankTransferRoutes = require('./routes/bank-transfer.routes');
const clearingRoutes     = require('./routes/clearing.routes');
// ============================================================
// 3. ROUTES API (V1)
// ============================================================
app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/patients',      patientRoutes);
app.use('/api/v1/doctors',       doctorRoutes);
app.use('/api/v1/appointments',  appointmentRoutes);
app.use('/api/v1/payments',      paymentRoutes);
app.use('/api/v1/payments/momo', momoRoutes);
app.use('/api/v1/payments/airtel', airtelRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);
app.use('/api/v1/pharmacies',    pharmacieRoutes);
app.use('/api/v1/laboratories',  laboratoireRoutes);
app.use('/api/v1/admin',         adminRoutes);
app.use('/api/v1/payouts',      payoutsRoutes);
app.use('/api/v1/bank-transfer', bankTransferRoutes);
app.use('/api/v1/clearing',      clearingRoutes);
app.use('/api/v1/articles',      require('./routes/articles.routes'));
app.use('/api/v1/credits',       creditsRoutes);
app.use('/api/v1/telemedicine',  telemedicineRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/reports',       reportRoutes);
app.use('/api/v1/lab',           labRoutes);
app.use('/api/v1/ratings',       ratingsRoutes);
app.use('/api/v1/map',           require('./routes/map.routes'));
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
            message: 'ðŸš€ ConnectÃ© au Cloud Neon', 
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

// Servir urgence.html pour la route /urgence (sans extension)
app.get('/urgence', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'urgence.html'));
});

// ============================================================
// 6. ROUTE 404
// ============================================================
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route introuvable' });
});

// ============================================================
// 7. SENTRY ERROR HANDLER
// ============================================================
Sentry.setupExpressErrorHandler(app);

// ============================================================
// 8. GESTION ERREUR GLOBALE
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

// ============================================================
// 8. INDEX DE PERFORMANCE
// ============================================================
const createIndexes = async () => {
    try {
        await Promise.all([
            pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role_active   ON users(role, is_active)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_users_phone_active  ON users(phone, is_active)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_users_created_at    ON users(created_at DESC)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_phone  ON appointments(patient_phone, doctor_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_date   ON appointments(appointment_date DESC)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_prescriptions_phone ON prescriptions(patient_phone, doctor_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_log_type      ON audit_log(event_type, created_at DESC)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_fraud_score         ON fraud_signals(fraud_score DESC, severity)`),
        ]);
        console.log('[INDEX] Tous les index de performance créés avec succès');
    } catch (e) {
        console.warn('[INDEX] Avertissement:', e.message);
    }
};

const addValidatedAtColumn = async () => {
    try {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ`);
        console.log('[SCHEMA] Colonne validated_at ajoutée avec succès');
    } catch (e) {
        console.warn('[SCHEMA] Avertissement validated_at:', e.message);
    }
};

const initializeApp = async () => {
    await createIndexes();
    await addValidatedAtColumn();
    
    // Log du schéma users pour debugging
    try {
        const { rows } = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY column_name`);
        console.log('[SCHEMA users]', rows.map(r => r.column_name).join(', '));
    } catch (e) {
        console.warn('[SCHEMA] Erreur lors du log du schéma users:', e.message);
    }
};

const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`âœ… Bolamu server running on port ${PORT}`);
    await initializeApp();
});

// Gestion du timeout pour Render
server.keepAliveTimeout = 120 * 1000; 
server.headersTimeout = 125 * 1000;

// Test de connexion DB après le lancement du serveur
// Test de connexion DB aprÃ¨s le lancement du serveur
async function checkDB() {
    try {
        await pool.query('SELECT 1');
        console.log('ðŸ“¡ ConnectÃ© Ã  Neon DB');
    } catch (err) {
        console.error('âŒ Connexion Neon Ã©chouÃ©e:', err.message);
    }
}
checkDB();
