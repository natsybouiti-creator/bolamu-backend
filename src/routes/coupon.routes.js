// ============================================================
// BOLAMU — Routes Coupons (Sprint 4)
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const {
    createCouponController,
    validateCouponController,
    listCouponsController
} = require('../controllers/coupon.controller');

// Middleware pour vérifier le rôle admin
function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
}

// ─── ROUTES ADMIN ─────────────────────────────────────────────────────────────
router.post('/admin/coupons', authMiddleware, adminOnly, createCouponController);
router.get('/admin/coupons', authMiddleware, adminOnly, listCouponsController);

// ─── ROUTES PUBLIQUES / AUTHENTIFIÉES ───────────────────────────────────────────
router.post('/coupons/validate', authMiddleware, validateCouponController);

module.exports = router;
