const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';

// 1. Middleware de base : Vérifie si l'utilisateur est connecté
function authMiddleware(req, res, next) {
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