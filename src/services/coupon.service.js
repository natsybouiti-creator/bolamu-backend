// ============================================================
// BOLAMU — Service Coupons (Sprint 4)
// ============================================================
const pool = require('../config/db');

// ─── VALIDER UN COUPON ───────────────────────────────────────────────────────
async function validateCoupon(code, user_phone, user_type, montant_base) {
    try {
        // a. Coupon existe et is_active = true
        const couponResult = await pool.query(
            `SELECT * FROM coupons WHERE code = $1 AND is_active = true`,
            [code]
        );

        if (!couponResult.rows.length) {
            return { valide: false, raison: 'Code invalide' };
        }

        const coupon = couponResult.rows[0];

        // b. Date expiration non dépassée
        if (coupon.date_expiration && new Date(coupon.date_expiration) < new Date()) {
            return { valide: false, raison: 'Coupon expiré' };
        }

        // c. Quota non atteint
        if (coupon.quota_total !== null && coupon.quota_utilise >= coupon.quota_total) {
            return { valide: false, raison: 'Quota épuisé' };
        }

        // d. Restriction user_type respectée
        if (coupon.user_type_restriction && coupon.user_type_restriction !== user_type) {
            return { valide: false, raison: 'Coupon non applicable à ce profil' };
        }

        // e. Usage unique : user_phone absent de coupon_usages pour ce coupon
        if (coupon.usage_unique_par_user) {
            const usageResult = await pool.query(
                `SELECT id FROM coupon_usages WHERE coupon_id = $1 AND user_phone = $2`,
                [coupon.id, user_phone]
            );

            if (usageResult.rows.length > 0) {
                return { valide: false, raison: 'Déjà utilisé par ce compte' };
            }
        }

        // Calculer la remise
        let montant_remise = 0;
        if (coupon.type === 'pourcentage') {
            montant_remise = (montant_base * coupon.valeur) / 100;
        } else if (coupon.type === 'fixe') {
            montant_remise = coupon.valeur;
        }

        // La remise ne peut pas dépasser le montant de base
        if (montant_remise > montant_base) {
            montant_remise = montant_base;
        }

        const montant_final = montant_base - montant_remise;

        return {
            valide: true,
            coupon_id: coupon.id,
            montant_remise: montant_remise,
            montant_final: montant_final,
            coupon_type: coupon.type,
            coupon_valeur: coupon.valeur
        };

    } catch (error) {
        console.error('[validateCoupon]', error.message);
        throw error;
    }
}

// ─── APPLIQUER UN COUPON ─────────────────────────────────────────────────────
async function applyCoupon(coupon_id, user_phone, subscription_id, montant_remise) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // INSERT coupon_usages
        await client.query(
            `INSERT INTO coupon_usages (coupon_id, user_phone, subscription_id, montant_remise)
             VALUES ($1, $2, $3, $4)`,
            [coupon_id, user_phone, subscription_id, montant_remise]
        );

        // UPDATE coupons SET quota_utilise = quota_utilise + 1
        await client.query(
            `UPDATE coupons SET quota_utilise = quota_utilise + 1 WHERE id = $1`,
            [coupon_id]
        );

        // INSERT audit_log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('coupon.applied', $1, 'coupon_usages', NULL, $2)`,
            [user_phone, JSON.stringify({ coupon_id, subscription_id, montant_remise })]
        ).catch(() => {});

        await client.query('COMMIT');

        return { success: true, message: 'Coupon appliqué avec succès' };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[applyCoupon]', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// ─── CRÉER UN COUPON (admin uniquement) ───────────────────────────────────────
async function createCoupon(data, admin_phone) {
    const { code, type, valeur, quota_total, date_expiration, user_type_restriction, usage_unique_par_user } = data;

    // Validation
    if (!code || !type || !valeur) {
        throw new Error('Champs obligatoires : code, type, valeur');
    }

    if (valeur <= 0) {
        throw new Error('La valeur doit être supérieure à 0');
    }

    if (date_expiration && new Date(date_expiration) <= new Date()) {
        throw new Error('La date d\'expiration doit être future');
    }

    try {
        // Vérifier que le code est unique
        const existingResult = await pool.query(
            `SELECT id FROM coupons WHERE code = $1`,
            [code]
        );

        if (existingResult.rows.length > 0) {
            throw new Error('Ce code existe déjà');
        }

        // INSERT coupons
        const result = await pool.query(
            `INSERT INTO coupons 
                (code, type, valeur, quota_total, date_expiration, user_type_restriction, usage_unique_par_user, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, code, type, valeur, quota_total, created_at`,
            [code, type, valeur, quota_total, date_expiration, user_type_restriction, usage_unique_par_user !== false, admin_phone]
        );

        // INSERT audit_log
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('coupon.created', $1, 'coupons', $2, $3)`,
            [admin_phone, result.rows[0].id, JSON.stringify({ code, type, valeur })]
        ).catch(() => {});

        return {
            success: true,
            data: result.rows[0]
        };

    } catch (error) {
        console.error('[createCoupon]', error.message);
        throw error;
    }
}

// ─── LISTER LES COUPONS (admin uniquement) ─────────────────────────────────────
async function listCoupons() {
    try {
        const result = await pool.query(
            `SELECT c.*, u.full_name as created_by_name
             FROM coupons c
             LEFT JOIN users u ON u.phone = c.created_by
             ORDER BY c.created_at DESC`
        );

        return {
            success: true,
            data: result.rows
        };

    } catch (error) {
        console.error('[listCoupons]', error.message);
        throw error;
    }
}

module.exports = {
    validateCoupon,
    applyCoupon,
    createCoupon,
    listCoupons
};
