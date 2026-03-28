const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Accès refusé — connexion requise"
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, phone, role }
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            message: "Token invalide ou expiré"
        });
    }
}

module.exports = authMiddleware;