const rateLimit = require('express-rate-limit');

// Limiteur strict : 5 requêtes / 15 minutes
// Pour les endpoints très sensibles (OTP, login)
const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        // Audit log en cas de dépassement
        const pool = require('../config/db');
        const phone = req.body?.phone || req.ip;
        pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('rate_limit.exceeded', $1, 'rate_limit', NULL, $2::jsonb)`,
            [phone, JSON.stringify({ endpoint: req.path, ip: req.ip })]
        ).catch(() => {});
        
        res.status(429).json({ 
            success: false, 
            message: 'Trop de tentatives. Réessayez dans 15 minutes.' 
        });
    }
});

// Limiteur standard : 30 requêtes / minute
// Pour toutes les routes /api/v1/ sauf webhook
const standardLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,
    message: { success: false, message: 'Trop de requêtes. Réessayez dans 1 minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const pool = require('../config/db');
        const phone = req.user?.phone || req.ip;
        pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('rate_limit.exceeded', $1, 'rate_limit', NULL, $2::jsonb)`,
            [phone, JSON.stringify({ endpoint: req.path, ip: req.ip })]
        ).catch(() => {});
        
        res.status(429).json({ 
            success: false, 
            message: 'Trop de requêtes. Réessayez dans 1 minute.' 
        });
    }
});

// Limiteur webhook : 100 requêtes / minute
// Pour les routes webhook MTN uniquement
const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: { success: false, message: 'Trop de webhooks. Réessayez dans 1 minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const pool = require('../config/db');
        pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('rate_limit.exceeded', 'webhook', 'rate_limit', NULL, $1::jsonb)`,
            [JSON.stringify({ endpoint: req.path, ip: req.ip })]
        ).catch(() => {});
        
        res.status(429).json({ 
            success: false, 
            message: 'Trop de webhooks. Réessayez dans 1 minute.' 
        });
    }
});

module.exports = {
    strictLimiter,
    standardLimiter,
    webhookLimiter
};
