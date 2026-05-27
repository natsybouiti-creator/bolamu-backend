// ============================================================
// BOLAMU — Contrôleur Coupons (Sprint 4)
// ============================================================
const pool = require('../config/db');
const { validateCoupon, applyCoupon, createCoupon, listCoupons } = require('../services/coupon.service');

// ─── CRÉER UN COUPON (admin uniquement) ───────────────────────────────────────
async function createCouponController(req, res) {
    const { code, type, valeur, quota_total, date_expiration, user_type_restriction, usage_unique_par_user } = req.body;
    const adminPhone = req.user.phone;

    try {
        const result = await createCoupon({
            code,
            type,
            valeur,
            quota_total,
            date_expiration,
            user_type_restriction,
            usage_unique_par_user
        }, adminPhone);

        return res.status(201).json(result);
    } catch (error) {
        console.error('[createCouponController]', error.message);
        return res.status(400).json({ success: false, message: error.message });
    }
}

// ─── VALIDER UN COUPON (patient/partner) ───────────────────────────────────────
async function validateCouponController(req, res) {
    const { code, montant_base } = req.body;
    const userPhone = req.user.phone;
    const userType = req.user.role;

    if (!code) {
        return res.status(400).json({ success: false, message: 'Code requis.' });
    }

    if (!montant_base || montant_base <= 0) {
        return res.status(400).json({ success: false, message: 'Montant de base requis et doit être positif.' });
    }

    try {
        const result = await validateCoupon(code, userPhone, userType, montant_base);
        return res.json(result);
    } catch (error) {
        console.error('[validateCouponController]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── LISTER LES COUPONS (admin uniquement) ─────────────────────────────────────
async function listCouponsController(req, res) {
    try {
        const result = await listCoupons();
        return res.json(result);
    } catch (error) {
        console.error('[listCouponsController]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = {
    createCouponController,
    validateCouponController,
    listCouponsController
};
