// ============================================================
// BOLAMU — Script Clearing Mensuel Partenaires
// ============================================================
// Exécution : node scripts/clearing-mensuel.js
// Cron job : 0 0 1 * * (1er de chaque mois à minuit)
// ============================================================

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

// ─── CALCULER PÉRIODE (1er du mois précédent → fin du mois précédent) ───────────────
function getPreviousMonthPeriod() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0]
    };
}

// ─── CLEARING POUR UN PARTENAIRE (transaction par partenaire) ─────────────────────
async function processPartnerZone(zone, period) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Vérifier qu'aucun payout n'existe déjà pour ce partenaire et cette période
        const existingRes = await client.query(
            `SELECT id FROM partner_payouts 
             WHERE partner_phone = $1 AND period_start = $2 AND period_end = $3`,
            [zone.partner_phone, period.start, period.end]
        );
        if (existingRes.rows.length > 0) {
            await client.query('ROLLBACK');
            console.log(`⏭️  Skipping ${zone.partner_phone} (${zone.partner_type}) — payout already exists`);
            return { success: false, reason: 'already_exists' };
        }

        // 2. Compter les adhérents actifs dans cette zone
        const countRes = await client.query(
            `SELECT COUNT(*) as count
             FROM subscriptions s
             JOIN users u ON u.phone = s.patient_phone
             WHERE s.is_active = TRUE 
             AND u.neighborhood = $1
             AND s.started_at <= $2
             AND (s.expires_at IS NULL OR s.expires_at > $2)`,
            [zone.zone_name, period.end]
        );
        const memberCount = parseInt(countRes.rows[0].count);

        if (memberCount === 0) {
            await client.query('ROLLBACK');
            console.log(`⏭️  Skipping ${zone.partner_phone} (${zone.partner_type}) — no active members`);
            return { success: false, reason: 'no_members' };
        }

        // 3. Calculer le montant
        const amountFcfa = memberCount * zone.fee_per_adherent;

        // 4. Récupérer le momo_number du partenaire
        let momoNumber = null;
        if (zone.partner_type === 'doctor') {
            const docRes = await client.query(
                `SELECT momo_number FROM doctors WHERE phone = $1`,
                [zone.partner_phone]
            );
            momoNumber = docRes.rows[0]?.momo_number;
        } else if (zone.partner_type === 'pharmacie') {
            const phRes = await client.query(
                `SELECT momo_number FROM pharmacies WHERE phone = $1`,
                [zone.partner_phone]
            );
            momoNumber = phRes.rows[0]?.momo_number;
        } else if (zone.partner_type === 'laboratoire') {
            const labRes = await client.query(
                `SELECT momo_number FROM laboratories WHERE phone = $1`,
                [zone.partner_phone]
            );
            momoNumber = labRes.rows[0]?.momo_number;
        }

        // 5. Créer le payout
        const payoutRes = await client.query(
            `INSERT INTO partner_payouts 
                (partner_phone, partner_type, period_start, period_end, member_count, amount_fcfa, status, momo_number)
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
             RETURNING id`,
            [zone.partner_phone, zone.partner_type, period.start, period.end, memberCount, amountFcfa, momoNumber]
        );

        // 6. Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('clearing.generated', 'system', 'partner_payouts', $1, $2)`,
            [payoutRes.rows[0].id.toString(), JSON.stringify({
                partner_phone: zone.partner_phone,
                partner_type: zone.partner_type,
                zone_name: zone.zone_name,
                member_count: memberCount,
                amount_fcfa: amountFcfa,
                period: period
            })]
        ).catch(() => {});

        await client.query('COMMIT');

        console.log(`✅ ${zone.partner_phone} (${zone.partner_type}) — ${memberCount} members → ${amountFcfa} FCFA`);
        return { success: true, memberCount, amountFcfa };

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(`❌ Error processing ${zone.partner_phone}:`, e.message);
        return { success: false, error: e.message };
    } finally {
        client.release();
    }
}

// ─── FONCTION PRINCIPALE ─────────────────────────────────────────────────────────
async function runClearing() {
    const period = getPreviousMonthPeriod();
    console.log(`🔄 Clearing mensuel pour la période : ${period.start} → ${period.end}`);
    console.log('────────────────────────────────────────────────────────────');

    try {
        // 1. Récupérer toutes les zones actives
        const zonesRes = await pool.query(
            `SELECT * FROM partner_zones WHERE is_active = TRUE`
        );
        const zones = zonesRes.rows;

        if (zones.length === 0) {
            console.log('⚠️  Aucune zone active trouvée dans partner_zones');
            return;
        }

        console.log(`📊 ${zones.length} zones actives trouvées`);
        console.log('────────────────────────────────────────────────────────────');

        // 2. Traiter chaque zone (transaction par partenaire)
        let totalProcessed = 0;
        let totalAmount = 0;
        let totalErrors = 0;

        for (const zone of zones) {
            const result = await processPartnerZone(zone, period);
            if (result.success) {
                totalProcessed++;
                totalAmount += result.amountFcfa;
            } else if (result.reason !== 'already_exists' && result.reason !== 'no_members') {
                totalErrors++;
            }
        }

        // 3. Résumé final
        console.log('────────────────────────────────────────────────────────────');
        console.log('📊 RÉSUMÉ CLEARING MENSUEL');
        console.log(`✅ Partenaires traités : ${totalProcessed}`);
        console.log(`💰 Total FCFA à verser : ${totalAmount.toLocaleString()} FCFA`);
        console.log(`❌ Erreurs : ${totalErrors}`);
        console.log(`📅 Période : ${period.start} → ${period.end}`);
        console.log('────────────────────────────────────────────────────────────');

    } catch (e) {
        console.error('❌ Erreur fatale lors du clearing:', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// ─── EXÉCUTION ───────────────────────────────────────────────────────────────────
runClearing();
