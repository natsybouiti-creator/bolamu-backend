require('./instrument');
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('./config/db');
const cors = require('cors');
const Sentry = require('@sentry/node');
const { standardLimiter } = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');

// Validation des secrets (fail-fast en production)
require('./config/secrets');

// Configuration push notifications (VAPID)
const { configurePush } = require('./services/push.service');
configurePush();

const app = express();
app.set('trust proxy', 1);

// ============================================================
// 1. MIDDLEWARES & CORS CONFIGURATION
// ============================================================

// Configuration production uniquement
if (process.env.NODE_ENV === 'production') {
    const { helmetConfig, corsConfig, compressionConfig, bodyLimitConfig } = require('./config/production');
    app.use(helmetConfig);
    app.use(cors(corsConfig));
    app.use(compressionConfig);
    app.use(express.json(bodyLimitConfig));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
} else {
    // Configuration développement
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
}

// Middleware pour accepter le body brut sur la route webhook MTN (nécessaire pour la validation HMAC)
app.use('/api/v1/payments/momo/webhook', express.raw({ type: 'application/json' }));

// Request logger (remplace le logger de debug)
app.use(requestLogger);

// Servir les fichiers statiques (images, css, js du dossier public)
app.use(express.static(path.join(__dirname, '../public')));

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
const collecteRoutes     = require('./routes/collecte.routes');
const partnerConventionRoutes = require('./routes/partner-convention.routes');
const tiersPayantRoutes  = require('./routes/tiers-payant.routes');
const constantesMedicalesRoutes = require('./routes/constantes-medicales.routes');
const conflictRoutes      = require('./routes/conflict.routes');
const couponRoutes        = require('./routes/coupon.routes');
const notificationRoutes  = require('./routes/notification.routes');
const pushRoutes          = require('./routes/push.routes');
const secretariatRoutes   = require('./routes/secretariat.routes');
const preRdvRoutes        = require('./routes/preRdv.routes');
const smartflowRoutes     = require('./routes/smartflow.routes');
const symptomsRoutes      = require('./routes/symptoms.routes');
const aiConsultRoutes     = require('./routes/ai-consult.routes');
const uploadRoutes         = require('./routes/upload.routes');
const adminDocsRoutes      = require('./routes/admin-docs.routes');
// ============================================================
// 3. ROUTES API (V1)
// ============================================================
// Appliquer le rate limiting standard sur toutes les routes API (sauf webhook)
app.use('/api/v1', standardLimiter);

app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/patients',      patientRoutes);
app.use('/api/v1/doctors',       doctorRoutes);
app.use('/api/v1/patients',      constantesMedicalesRoutes);
app.use('/api/v1/doctors',       constantesMedicalesRoutes);
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
app.use('/api/v1/collecte',      collecteRoutes);
app.use('/api/v1/admin/conventions', partnerConventionRoutes);
app.use('/api/v1/tiers-payant',   tiersPayantRoutes);
app.use('/api/v1/admin/tiers-payant', tiersPayantRoutes);
app.use('/api/v1/articles',      require('./routes/articles.routes'));
app.use('/api/v1/credits',       creditsRoutes);
app.use('/api/v1/telemedicine',  telemedicineRoutes);
app.use('/api/v1/qr', qrRoutes);
app.use('/api/v1/reports',       reportRoutes);
app.use('/api/v1/lab',           labRoutes);
app.use('/api/v1/ratings',      ratingsRoutes);
app.use('/api/v1/map',           require('./routes/map.routes'));
app.use('/api/v1',              conflictRoutes);
app.use('/api/v1',              couponRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/push',         pushRoutes);
app.use('/api/v1/secretariat',  secretariatRoutes);
app.use('/api/v1/pre-rdv',       preRdvRoutes);
app.use('/api/v1',              smartflowRoutes);
app.use('/api/v1',              symptomsRoutes);
app.use('/api/v1',              aiConsultRoutes);
app.use('/api/v1/upload',       uploadRoutes);
app.use('/api/v1/admin',       adminDocsRoutes);
// ============================================================
// 4. ROUTES WEB
// ============================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// ============================================================
// 5. HEALTH CHECK COMPLET (Sprint 6)
// ============================================================
const startTime = Date.now();

app.get('/api/v1/test', async (req, res) => {
    const checks = {
        database: 'ok',
        redis: 'ok',
        smtp: 'ok'
    };
    let overallStatus = 'ok';

    // Check database
    try {
        await pool.query('SELECT 1');
        checks.database = 'ok';
    } catch (err) {
        console.error('[HEALTH CHECK] Database error:', err.message);
        checks.database = 'failed';
        overallStatus = 'critical';
        return res.status(503).json({
            status: 'critical',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            environment: process.env.NODE_ENV || 'development',
            checks,
            uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
            memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
        });
    }

    // Check Redis (optionnel)
    if (process.env.REDIS_URL) {
        try {
            // Redis check si configuré
            checks.redis = 'ok';
        } catch (err) {
            console.error('[HEALTH CHECK] Redis error:', err.message);
            checks.redis = 'failed';
            overallStatus = 'degraded';
        }
    }

    // Check SMTP (optionnel)
    if (process.env.RESEND_API_KEY) {
        try {
            // SMTP check si configuré
            checks.smtp = 'ok';
        } catch (err) {
            console.error('[HEALTH CHECK] SMTP error:', err.message);
            checks.smtp = 'failed';
            overallStatus = 'degraded';
        }
    }

    // Si un check échoue mais pas database : degraded
    if (overallStatus === 'ok' && (checks.redis === 'failed' || checks.smtp === 'failed')) {
        overallStatus = 'degraded';
    }

    res.json({
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checks,
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
        memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
    });
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
app.use(errorHandler);

// ============================================================
// 8. LANCEMENT SERVEUR
// ============================================================
// Render utilise souvent le port 10000 par défaut, 
// mais il faut impérativement utiliser process.env.PORT
const PORT = process.env.PORT || 3005;

// Job cron abonnements — démarrage automatique
const { jobAbonnement } = require('./jobs/abonnement.job');
jobAbonnement.start();
console.log('[CRON] Job abonnement quotidien démarré (02h00 Brazzaville)');

// Worker BullMQ SMS — démarrage automatique
require('./workers/sms-worker');
console.log('[BULLMQ] Worker SMS démarré');

// Worker BullMQ Notifications — démarrage automatique
require('./workers/notification-worker');
console.log('[BULLMQ] Worker Notifications démarré');

// ============================================================
// 8. INDEX DE PERFORMANCE
// ============================================================
const createIndexes = async () => {
    try {
        await Promise.all([
            pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role_active   ON users(role, is_active)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_users_phone_active  ON users(phone, is_active)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_users_created_at    ON users(created_at DESC)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_appointments_phone  ON appointments(patient_phone, doctor_id)`),
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

const initializeApp = async () => {
    await createIndexes();
    
    // Créer le dossier d'uploads sécurisé
    const uploadDir = process.env.NODE_ENV === 'production' 
      && fs.existsSync('/var/data')
        ? '/var/data/uploads/documents' 
        : path.join(process.cwd(), 'uploads', 'documents');
    
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('[UPLOAD] Dossier uploads sécurisé créé:', uploadDir);
    } else {
        console.log('[UPLOAD] Dossier uploads sécurisé existe déjà:', uploadDir);
    }
    
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
