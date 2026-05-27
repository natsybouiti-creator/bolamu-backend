// ============================================================
// BOLAMU — Configuration Production (Sprint 6)
// ============================================================
const helmet = require('helmet');
const compression = require('compression');

// Configuration Helmet avec CSP strict
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
            connectSrc: ["'self'", "https://bolamu-backend.onrender.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// CORS : whitelist domaines autorisés uniquement
const corsConfig = {
    origin: function(origin, callback) {
        // Autoriser les requêtes sans origin (Postman, mobile apps, curl)
        if (!origin) return callback(null, true);

        const allowedOrigins = [
            'https://bolamu.co',
            'https://app.bolamu.co',
            'https://www.bolamu.co',
            'https://bolamu-backend.onrender.com'
        ];

        // En développement, autoriser localhost
        if (process.env.NODE_ENV !== 'production') {
            allowedOrigins.push('http://localhost:3000', 'http://localhost:10000');
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Non autorisé par CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    maxAge: 86400 // 24 heures
};

// Compression gzip activée
const compressionConfig = compression({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    },
    threshold: 1024, // Comprimer seulement si > 1KB
    level: 6 // Niveau de compression (1-9)
});

// Limite body : 10mb max
const bodyLimitConfig = {
    limit: '10mb',
    extended: true
};

module.exports = {
    helmetConfig,
    corsConfig,
    compressionConfig,
    bodyLimitConfig
};
