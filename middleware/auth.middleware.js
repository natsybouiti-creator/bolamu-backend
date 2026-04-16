const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';

// Rôles reconnus comme administrateurs
const ADMIN_ROLES = ['admin', 'content_admin'];

/**
 * Middleware d'authentification JWT de base
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Token manquant ou invalide.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Token expiré ou invalide.' });
    }
}

/**
 * Middleware de vérification admin (admin OPS + content_admin)
 */
const requireAdmin = (req, res, next) => {
    if (!ADMIN_ROLES.includes(req.user?.role)) {
        return res.status(403).json({
            success: false,
            message: 'Accès admin requis.'
        });
    }
    next();
};

/**
 * Middleware strictement OPS admin
 */
const requireOpsAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Action réservée à l\'administrateur opérationnel.'
        });
    }
    next();
};

// Exportation sous forme d'objet
module.exports = { authMiddleware, requireAdmin, requireOpsAdmin };