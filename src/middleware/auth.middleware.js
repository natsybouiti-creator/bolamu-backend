const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const logger = require('../config/logger');

if (!process.env.JWT_SECRET) {
    throw new Error('[FATAL] JWT_SECRET non défini. Configurez cette variable dans Render.');
}
const JWT_SECRET = process.env.JWT_SECRET;

// 1. Middleware de base : Vérifie si l'utilisateur est connecté
async function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Accès refusé — connexion requise"
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        
        // Si is_active et banned sont dans le token, on évite la requête DB
        if (decoded.is_active === false) {
            return res.status(403).json({ success: false, message: 'Compte inactif ou suspendu.' });
        }
        if (decoded.banned === true) {
            return res.status(403).json({ success: false, message: 'Compte banni.' });
        }

        // Vérification DB uniquement si pas dans le token (anciens tokens)
        if (decoded.is_active === undefined) {
            const userCheck = await pool.query(
                'SELECT is_active, banned FROM users WHERE phone = $1',
                [decoded.phone]
            );
            if (!userCheck.rows.length || !userCheck.rows[0].is_active) {
                return res.status(403).json({ success: false, message: 'Compte inactif ou suspendu.' });
            }
            if (userCheck.rows[0].banned) {
                return res.status(403).json({ success: false, message: 'Compte banni.' });
            }
        }
        
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            message: "Token invalide ou expiré"
        });
    }
}

// 2. Middleware pour l'accès aux interfaces Admin (Ops ou Content)
// Combine authMiddleware + vérification rôle
authMiddleware.requireAdmin = async (req, res, next) => {
    const rolesAutorises = ['admin', 'content_admin'];
    
    // 1. Essayer le token depuis le header Authorization
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader) {
        token = authHeader.split(' ')[1];
    }
    
    // 2. Essayer le token depuis le cookie
    if (!token && req.cookies && req.cookies.bolamu_admin_token) {
        token = req.cookies.bolamu_admin_token;
    }

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Accès refusé — connexion requise"
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;

        if (!rolesAutorises.includes(decoded.role)) {
            return res.status(403).json({
                success: false,
                message: "Accès interdit : Droits d'administration requis."
            });
        }

        if (decoded.is_active === false) {
            return res.status(403).json({ success: false, message: 'Compte inactif ou suspendu.' });
        }
        if (decoded.banned === true) {
            return res.status(403).json({ success: false, message: 'Compte banni.' });
        }

        if (decoded.is_active === undefined) {
            const userCheck = await pool.query(
                'SELECT is_active, banned FROM users WHERE phone = $1',
                [decoded.phone]
            );
            if (!userCheck.rows.length || !userCheck.rows[0].is_active) {
                return res.status(403).json({ success: false, message: 'Compte inactif ou suspendu.' });
            }
            if (userCheck.rows[0].banned) {
                return res.status(403).json({ success: false, message: 'Compte banni.' });
            }
        }

        next();
    } catch (err) {
        logger.error('[REQUIRE_ADMIN] Token error:', err.message);
        return res.status(403).json({
            success: false,
            message: "Token invalide ou expiré"
        });
    }
};

// 3. Middleware pour l'accès Secrétariat
authMiddleware.requireSecretary = (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
    if (!['secretaire', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux secrétaires' });
    }
    // Attacher clinic_id depuis le token
    if (req.user.clinic_id) {
        req.user.clinic_id = req.user.clinic_id;
    }
    next();
};

// 4. Middleware pour l'accès RH Grand Compte
authMiddleware.requireRH = (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
    if (!['company_rh', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux RH entreprise' });
    }
    // Attacher company_id depuis le token
    if (req.user.company_id) {
        req.user.company_id = req.user.company_id;
    }
    next();
};

// 5. Middleware pour les actions sensibles (Seulement l'Admin Principal)
authMiddleware.requireOpsAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: "Action réservée à l'administrateur opérationnel principal." 
        });
    }
    next();
};

module.exports = authMiddleware;