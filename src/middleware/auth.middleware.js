const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';

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
authMiddleware.requireAdmin = (req, res, next) => {
    const rolesAutorises = ['admin', 'content_admin'];
    
    if (!req.user || !rolesAutorises.includes(req.user.role)) {
        return res.status(403).json({ 
            success: false, 
            message: "Accès interdit : Droits d'administration requis." 
        });
    }
    next();
};

// 3. Middleware pour les actions sensibles (Seulement l'Admin Principal)
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