const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'bcbd5ea11381ab60f10bae67784495cc2b3ed3fbcbdf353d913d7d454ff33f35';

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
    
    // 3. Essayer le token depuis le query param (pour les liens directs vers fichiers)
    if (!token && req.query.token) {
        token = req.query.token;
    }
    
    // Log temporaire pour debug
    console.log('[REQUIRE_ADMIN] Token from header:', !!authHeader, 'Token from cookie:', !!(req.cookies && req.cookies.bolamu_admin_token), 'Token from query:', !!req.query.token, 'Token present:', !!token);
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Accès refusé — connexion requise"
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        
        console.log('[REQUIRE_ADMIN] Decoded user:', { phone: decoded.phone, role: decoded.role });
        
        if (!rolesAutorises.includes(decoded.role)) {
            return res.status(403).json({ 
                success: false, 
                message: "Accès interdit : Droits d'administration requis." 
            });
        }
        
        next();
    } catch (err) {
        console.error('[REQUIRE_ADMIN] Token error:', err.message);
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
    if (!['rh', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Accès réservé aux RH entreprise' });
    }
    // Attacher clinic_id depuis le token
    if (req.user.clinic_id) {
        req.user.clinic_id = req.user.clinic_id;
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