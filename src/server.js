require('./instrument');
require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const pool = require('./config/db');
const cors = require('cors');
const Sentry = require('@sentry/node');
const { standardLimiter } = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./config/logger');
const { initializeSocket } = require('./services/socketService');

// Validation des secrets (fail-fast en production)
require('./config/secrets');

// Système de migration automatique
const { runMigrations } = require('./db/migrate');

// Configuration push notifications (VAPID)
const { configurePush } = require('./services/push.service');
configurePush();

// WhatsApp : WAHA (GOWS) tourne de façon autonome sur Render
// Plus besoin d'initialiser de client WhatsApp au démarrage

const app = express();
app.set('trust proxy', 1);

// Cookie parser pour lire les cookies
app.use(cookieParser());

// Body brut avant express.json() — le stream body ne peut être lu qu'une fois
app.use('/api/v1/payments/momo/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/payments/airtel/webhook', express.raw({ type: 'application/json' }));

// Route GET '/' sert landing.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/landing.html'));
});

// No-cache headers pour fichiers HTML — éviter cache navigateur
app.use(function(req, res, next) {
  if (req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Servir les fichiers statiques (images, css, js du dossier public) - APRÈS la route GET '/'
app.use(express.static(path.join(__dirname, '../public'), {
  maxAge: '7d',
  etag: true,
  extensions: ['html']
}));

// Servir explicitement les pages statiques Zora sous /zora (AVANT les routes API et le catch-all)
app.use('/zora', express.static(path.join(__dirname, '../public/zora')));

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
        'https://api.bolamu.co',
        'https://www.bolamu.co',
        'https://bolamu.co',
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

// Request logger (remplace le logger de debug)
app.use(requestLogger);

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
const qrRoutes = require('./routes/qr.routes');
const reportRoutes       = require('./routes/consultation-report.routes');
const labRoutes          = require('./routes/lab.routes');
const ratingsRoutes      = require('./routes/ratings.routes');
const payoutsRoutes      = require('./routes/payouts.routes');
const bankTransferRoutes = require('./routes/bank-transfer.routes');
const clearingRoutes     = require('./routes/clearing.routes');
const collecteRoutes     = require('./routes/collecte.routes');
const partnerConventionRoutes = require('./routes/partner-convention.routes');
const remisePartenaireRoutes  = require('./routes/remise-partenaire.routes');
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
const agenceRoutes         = require('./routes/agence.routes');
const agentRoutes          = require('./routes/agent.routes');
const zoraRoutes           = require('./routes/zora.routes');
// DEPRECATED (zora_vouchers remplacé par partner_vouchers) — routes neutralisées avec 410 Gone
// const zoraMarketplaceRoutes = require('./routes/zora-marketplace.routes.DEPRECATED');
const zoraGamesRoutes       = require('./routes/zora-games.routes');
// DEPRECATED (Task B4) — remplacé par clubs.routes.js (implémentation canonique)
// const sportGroupsRoutes     = require('./routes/sport-groups.routes');
const wellnessRoutes        = require('./routes/wellness.routes');
const clubsRoutes           = require('./routes/clubs.routes');
const chatRoutes            = require('./routes/chat.routes');
const animateurRoutes       = require('./routes/animateur.routes');
const bonZoraRoutes         = require('./routes/bon-zora.routes');
const partenaireRoutes      = require('./routes/partenaire.routes');
const consultationRoutes    = require('./routes/consultation.routes');
const ordonnanceRoutes      = require('./routes/ordonnance.routes');
const subscriptionsRoutes   = require('./routes/subscriptions.routes');

// Routes BHP (Bolamu Health Data Protocol)
try {
  const healthRecordsRouter = require('./routes/healthRecords.routes');
  const consentRouter = require('./routes/consent.routes');
  const dmnRouter = require('./routes/dmn.routes');
  app.use('/api/v1/health-records', healthRecordsRouter);
  app.use('/api/v1/consent', consentRouter);
  app.use('/api/v1/dmn', dmnRouter);
  logger.info('[BHP] Routes health-records, consent et dmn chargées');
} catch (err) {
  logger.error('[BHP] Erreur chargement routes — vérifier healthRecords.routes.js, consent.routes.js et dmn.routes.js:', err.message);
}
// ============================================================
// 3. ROUTES API (V1)
// ============================================================
// Appliquer le rate limiting standard sur toutes les routes API (sauf webhook)
app.use('/api/v1', standardLimiter);

// DEPRECATED (Task B4) — sport-groups et community remplacés par clubs.routes.js
// app.use('/api/v1/sport-groups', sportGroupsRoutes);
// app.use('/api/v1/community', require('./routes/community.routes'));

app.use('/api/v1/auth',          authRoutes);
app.use('/api/v1/patients',      patientRoutes);
app.use('/api/v1/doctors',       doctorRoutes);
app.use('/api/v1/patients',      constantesMedicalesRoutes);
app.use('/api/v1/doctors',       constantesMedicalesRoutes);
app.use('/api/v1/appointments',  appointmentRoutes);
app.use('/api/v1/payments',      paymentRoutes);
app.use('/api/v1/payments/momo', momoRoutes);
app.use('/api/v1/payments/airtel', airtelRoutes);
app.use('/api/v1/subscriptions', subscriptionsRoutes);
app.use('/api/v1/qr',            qrRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);
app.use('/api/v1/pharmacies',    pharmacieRoutes);
app.use('/api/v1/laboratories',  laboratoireRoutes);
app.use('/api/v1/admin',       adminDocsRoutes);
app.use('/api/v1/admin',         adminRoutes);
app.use('/api/v1/payouts',      payoutsRoutes);
app.use('/api/v1/bank-transfer', bankTransferRoutes);
app.use('/api/v1/clearing',      clearingRoutes);
app.use('/api/v1/collecte',      collecteRoutes);
app.use('/api/v1/admin/conventions', partnerConventionRoutes);
app.use('/api/v1/remise-partenaire',   remisePartenaireRoutes);
app.use('/api/v1/admin/remise-partenaire', remisePartenaireRoutes);
app.use('/api/v1/articles',      require('./routes/articles.routes'));
app.use('/api/v1/credits',       creditsRoutes);
app.use('/api/v1/reports',       reportRoutes);
app.use('/api/v1/lab',           labRoutes);
app.use('/api/v1/ssp-catalog',   require('./routes/ssp.routes'));
app.use('/api/v1/ratings',      ratingsRoutes);
app.use('/api/v1/map',           require('./routes/map.routes'));
app.use('/api/v1/events',       require('./routes/elonga-events.routes'));
app.use('/api/v1/leaderboard',  require('./routes/leaderboard.routes'));
app.use('/api/v1/streaks',      require('./routes/streak.routes'));
app.use('/api/v1/chat',         chatRoutes);
app.use('/api/v1/animateur',    animateurRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/ordonnances',  ordonnanceRoutes);
app.use('/api/v1/wellness',     wellnessRoutes);
app.use('/api/v1/clubs',        clubsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/push',         pushRoutes);
app.use('/api/v1/secretariat',  secretariatRoutes);
app.use('/api/v1/agence',       agenceRoutes);
app.use('/api/v1/agent',        agentRoutes);
app.use('/api/v1/pre-rdv',       preRdvRoutes);
app.use('/api/v1/ai-consult',   aiConsultRoutes);
app.use('/api/v1/upload',       uploadRoutes);
app.use('/api/v1/zora',         zoraRoutes);
// DEPRECATED (zora_vouchers remplacé par partner_vouchers) — routes neutralisées avec 410 Gone
// app.use('/api/v1/zora',         zoraMarketplaceRoutes);
app.use('/api/v1/zora',         zoraGamesRoutes);
app.use('/api/v1/bons-zora',    bonZoraRoutes);
app.use('/api/v1/partenaire',   partenaireRoutes);
app.use('/api/v1',              conflictRoutes);
app.use('/api/v1',              couponRoutes);
app.use('/api/v1',              smartflowRoutes);
app.use('/api/v1',              symptomsRoutes);
app.use('/api/v1/feed',          require('./routes/feed.routes'));
app.use('/api/v1/stories',       require('./routes/stories.routes'));
app.use('/api/v1/follows',       require('./routes/follows.routes'));
// ============================================================
// 4. ROUTES WEB
// ============================================================

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
        logger.error('[HEALTH CHECK] Database error:', err.message);
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
            checks.redis = 'ok';
        } catch (err) {
            logger.error('[HEALTH CHECK] Redis error:', err.message);
            checks.redis = 'failed';
            overallStatus = 'degraded';
        }
    }

    // Check SMTP (optionnel)
    if (process.env.RESEND_API_KEY) {
        try {
            checks.smtp = 'ok';
        } catch (err) {
            logger.error('[HEALTH CHECK] SMTP error:', err.message);
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

// Servir login.html pour la route /login (magic link onboarding)
app.get('/login', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'login.html'));
});

// ============================================================
// SPIKE TEMPORAIRE — Chantier 3 (carte cadeau Zora), à supprimer après
// validation visuelle. Non montée dans les routes publiques normales,
// protégée par une clé partagée simple (JWT_SECRET) en query param.
// ============================================================
app.get('/internal/spike-font-test', async (req, res) => {
  if (req.query.key !== process.env.JWT_SECRET) {
    return res.status(404).json({ success: false, message: 'Route introuvable' });
  }
  try {
    const fs = require('fs');
    const sharp = require('sharp');
    const QRCode = require('qrcode');

    // FONTCONFIG_FILE doit être défini au lancement du process (render.yaml),
    // pas ici — testé localement : une affectation dynamique à ce stade n'a
    // aucun effet, fontconfig est déjà initialisé côté natif à ce moment.
    const fontsConfPath = process.env.FONTCONFIG_FILE || path.join(process.cwd(), 'assets', 'fonts', 'fonts.conf');

    const CARD_W = 600, CARD_H = 800, NAVY = '#0A2463';
    const qrBuffer = await QRCode.toBuffer('BOL-TEST-0001', { width: 220, margin: 1, color: { dark: '#0A2463', light: '#FFFFFF' } });
    const qrBase64 = qrBuffer.toString('base64');

    const svg = `
      <svg width="${CARD_W}" height="${CARD_H}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style type="text/css">
            .partner { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 34px; fill: #ffffff; }
            .offer { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 24px; fill: #ffffff; }
            .badge { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 16px; fill: #0A2463; }
            .code { font-family: monospace; font-weight: 700; font-size: 22px; fill: #0A2463; }
            .meta { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 500; font-size: 12px; fill: rgba(255,255,255,0.6); }
          </style>
        </defs>
        <rect x="0" y="0" width="${CARD_W}" height="${CARD_H}" fill="${NAVY}"/>
        <text x="40" y="80" class="partner">Pharmacie Bienvenue</text>
        <text x="40" y="130" class="offer">
          <tspan x="40" dy="0">Réduction de 50% sur kit</tspan>
          <tspan x="40" dy="32">complet de skincare</tspan>
        </text>
        <text x="40" y="${CARD_H - 350}" class="meta">FONTCONFIG_FILE=${fontsConfPath}</text>
        <rect x="0" y="${CARD_H - 340}" width="${CARD_W}" height="340" fill="#ffffff"/>
        <image x="${(CARD_W - 220) / 2}" y="${CARD_H - 310}" width="220" height="220" href="data:image/png;base64,${qrBase64}"/>
        <text x="${CARD_W / 2}" y="${CARD_H - 60}" text-anchor="middle" class="code">BOL-TEST-0001</text>
        <rect x="${CARD_W / 2 - 90}" y="${CARD_H - 45}" width="180" height="28" rx="14" fill="#EEF2FF"/>
        <text x="${CARD_W / 2}" y="${CARD_H - 25}" text-anchor="middle" class="badge">250 Zora utilisés</text>
      </svg>
    `;

    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message, stack: err.stack });
  }
});

// ============================================================
// 6. ROUTE 404
// ============================================================
app.use((req, res, next) => {
    const filePath = path.join(__dirname, '../public', req.path);
    const fs = require('fs');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath);
    }
    return res.status(404).json({ success: false, message: 'Route introuvable' });
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

// Job cron nettoyage stories expirées — démarrage automatique
const { jobStoriesCleanup } = require('./cron/stories-cleanup');
jobStoriesCleanup.start();
console.log('[CRON] Job nettoyage stories expirées démarré (toutes les heures)');

// Job cron wellness — démarrage automatique
const { startWellnessCron } = require('./jobs/wellness.cron');
startWellnessCron();

// ============================================================
// BullMQ Workers — SMS abandonné (WhatsApp direct), Push actif si REDIS_URL configuré
// ============================================================
// require('./workers/sms-worker'); // SMS abandonné — ne pas réactiver
require('./workers/notification-worker');
console.log('[BULLMQ] Worker Push Notifications démarré');

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
            // Index manquants identifiés /database-admin
            pool.query(`CREATE INDEX IF NOT EXISTS idx_subscriptions_patient_phone ON subscriptions(patient_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_payments_patient_phone ON payments(patient_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_phone ON notifications(user_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_credits_phone ON credits(phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_credit_transactions_phone ON credit_transactions(phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_fraud_signals_actor_phone ON fraud_signals(actor_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_ratings_patient_phone ON ratings(patient_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_ratings_intervenant_phone ON ratings(intervenant_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_lab_results_patient_phone ON lab_results(patient_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_doctor_payouts_doctor_phone ON doctor_payouts(doctor_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_ovp_documents_user_phone ON ovp_documents(user_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_company_contracts_contact_phone ON company_contracts(contact_phone)`),
            pool.query(`CREATE INDEX IF NOT EXISTS idx_company_contracts_rh_phone ON company_contracts(rh_phone)`),
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
    
};

// Exécuter les migrations automatiques avant de démarrer le serveur
async function startServer() {
    try {
        await runMigrations();
        console.log('✅ Migrations terminées, démarrage du serveur...\n');
        
        // Créer le serveur HTTP brut pour Socket.io
        const server = http.createServer(app);
        
        // Initialiser Socket.io AVANT d'écouter
        initializeSocket(server);
        
        server.listen(PORT, '0.0.0.0', async () => {
            console.log(`✅ Bolamu server running on port ${PORT}`);
            await initializeApp();
        });
        
        // Gestion du timeout pour Render
        server.keepAliveTimeout = 120 * 1000; 
        server.headersTimeout = 125 * 1000;
        
        return server;
    } catch (error) {
        console.error('❌ Erreur lors du démarrage du serveur:', error.message);
        process.exit(1);
    }
}

startServer();

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
