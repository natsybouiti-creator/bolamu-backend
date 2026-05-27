// ============================================================
// BOLAMU — Service Prorata (Sprint 4)
// ============================================================
const pool = require('../config/db');
const { validateCoupon, applyCoupon } = require('./coupon.service');

// ─── CALCULER PRORATA ───────────────────────────────────────────────────────────
async function calculProrata(ancien_plan, nouveau_plan, date_upgrade) {
    try {
        // Lire les tarifs depuis platform_config (jamais hardcodés)
        const configResult = await pool.query(
            `SELECT key, value FROM platform_config WHERE key IN 
                ('subscription_bronze_price', 'subscription_silver_price', 'subscription_gold_price')`
        );

        const prices = {};
        configResult.rows.forEach(row => {
            prices[row.key] = parseFloat(row.value);
        });

        const prix_ancien = prices[`subscription_${ancien_plan.toLowerCase()}_price`] || 0;
        const prix_nouveau = prices[`subscription_${nouveau_plan.toLowerCase()}_price`] || 0;

        // Récupérer la date d'expiration de l'abonnement actuel
        const subscriptionResult = await pool.query(
            `SELECT expires_at FROM subscriptions 
             WHERE patient_phone = (SELECT phone FROM users WHERE role = 'patient' LIMIT 1)
             AND plan = $1 AND status = 'active'
             ORDER BY expires_at DESC LIMIT 1`,
            [ancien_plan]
        );

        if (!subscriptionResult.rows.length) {
            throw new Error('Abonnement actuel introuvable');
        }

        const date_expiration = new Date(subscriptionResult.rows[0].expires_at);
        const upgradeDate = new Date(date_upgrade);

        // Formule
        const jours_restants = Math.ceil((date_expiration - upgradeDate) / (1000 * 60 * 60 * 24));
        const tarif_quotidien_ancien = prix_ancien / 30;
        const credit_restant = jours_restants * tarif_quotidien_ancien;
        let montant_du = prix_nouveau - credit_restant;

        // Si montant_du < 0 : montant_du = 0 (jamais négatif — TC-152)
        if (montant_du < 0) {
            montant_du = 0;
        }

        return {
            jours_restants,
            credit_restant: Math.round(credit_restant * 100) / 100,
            montant_du: Math.round(montant_du * 100) / 100,
            ancien_plan,
            nouveau_plan,
            prix_ancien,
            prix_nouveau
        };

    } catch (error) {
        console.error('[calculProrata]', error.message);
        throw error;
    }
}

// ─── UPGRADE ABONNEMENT ────────────────────────────────────────────────────────
async function upgradeAbonnement(patient_phone, nouveau_plan, coupon_code) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Récupérer l'abonnement actuel
        const currentSubResult = await client.query(
            `SELECT id, plan, expires_at FROM subscriptions 
             WHERE patient_phone = $1 AND status = 'active'
             ORDER BY expires_at DESC LIMIT 1`,
            [patient_phone]
        );

        if (!currentSubResult.rows.length) {
            await client.query('ROLLBACK');
            throw new Error('Aucun abonnement actif trouvé');
        }

        const currentSub = currentSubResult.rows[0];
        const ancien_plan = currentSub.plan;

        // calculProrata pour obtenir montant_du
        const prorataResult = await calculProrata(ancien_plan, nouveau_plan, new Date());
        let montant_du = prorataResult.montant_du;

        // Si coupon_code : validateCoupon puis ajuster montant_du
        let coupon_applique = null;
        if (coupon_code) {
            const userResult = await client.query(`SELECT role FROM users WHERE phone = $1`, [patient_phone]);
            const user_type = userResult.rows[0]?.role || 'patient';

            const couponValidation = await validateCoupon(coupon_code, patient_phone, user_type, montant_du);
            if (!couponValidation.valide) {
                await client.query('ROLLBACK');
                throw new Error(couponValidation.raison);
            }

            montant_du = couponValidation.montant_final;
            coupon_applique = {
                coupon_id: couponValidation.coupon_id,
                montant_remise: couponValidation.montant_remise
            };
        }

        // Si montant_du = 0 : activer directement sans paiement
        if (montant_du === 0) {
            // UPDATE subscription
            const new_expires_at = new Date();
            new_expires_at.setDate(new_expires_at.getDate() + 30);

            await client.query(
                `UPDATE subscriptions 
                 SET plan = $1, expires_at = $2, updated_at = NOW() 
                 WHERE id = $3`,
                [nouveau_plan, new_expires_at, currentSub.id]
            );

            // INSERT historique_abonnements
            await client.query(
                `INSERT INTO historique_abonnements 
                    (patient_phone, ancien_plan, nouveau_plan, montant_du, coupon_applique, date_upgrade)
                 VALUES ($1, $2, $3, $4, $5, NOW())`,
                [patient_phone, ancien_plan, nouveau_plan, montant_du, JSON.stringify(coupon_applique)]
            );

            // Appliquer le coupon si présent
            if (coupon_applique) {
                await applyCoupon(coupon_applique.coupon_id, patient_phone, currentSub.id, coupon_applique.montant_remise);
            }

            // Audit log
            await client.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                 VALUES ('subscription.upgraded', $1, 'subscriptions', $2, $3)`,
                [patient_phone, currentSub.id, JSON.stringify({ ancien_plan, nouveau_plan, montant_du })]
            ).catch(() => {});

            await client.query('COMMIT');

            return {
                success: true,
                message: 'Abonnement upgradé avec succès (sans paiement)',
                data: {
                    ancien_plan,
                    nouveau_plan,
                    montant_du,
                    prorata: prorataResult
                }
            };
        }

        // Sinon : initier paiement MTN MoMo pour montant_du
        // Note : L'initiation du paiement sera gérée par le controller
        await client.query('ROLLBACK');

        return {
            success: true,
            payment_required: true,
            montant_du,
            prorata: prorataResult,
            coupon_applique
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[upgradeAbonnement]', error.message);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    calculProrata,
    upgradeAbonnement
};
