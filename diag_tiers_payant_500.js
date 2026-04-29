const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function diagnose() {
    try {
        console.log('🔍 Diagnostic erreur 500 tiers-payant/initier\n');
        
        // 1. Vérifier patient abonnement actif
        console.log('1. Patient +242069735418 : abonnement actif ?');
        const subRes = await pool.query(
            `SELECT id, plan, status, expires_at, is_active 
             FROM subscriptions 
             WHERE patient_phone = '+242069735418' 
             AND status = 'active' 
             AND expires_at >= NOW()`
        );
        if (subRes.rows.length === 0) {
            console.log('   ❌ AUCUN abonnement actif trouvé !');
        } else {
            console.log(`   ✅ Abonnement actif : plan=${subRes.rows[0].plan}, expires=${subRes.rows[0].expires_at}`);
        }
        
        // 2. Vérifier convention pharmacie
        console.log('\n2. Pharmacie +242066226116 : convention active ?');
        const convRes = await pool.query(
            `SELECT id, partner_type, status_new, discount_rate 
             FROM partner_conventions 
             WHERE partner_phone = '+242066226116' 
             AND status_new = 'actif'`
        );
        if (convRes.rows.length === 0) {
            console.log('   ❌ AUCUNE convention active trouvée !');
        } else {
            console.log(`   ✅ Convention active : id=${convRes.rows[0].id}, rate=${convRes.rows[0].discount_rate}`);
        }
        
        // 3. Vérifier taux dans platform_config
        console.log('\n3. Taux dans platform_config :');
        const rateRes = await pool.query(
            `SELECT config_key, config_value FROM platform_config 
             WHERE config_key LIKE 'discount_rate%'`
        );
        if (rateRes.rows.length === 0) {
            console.log('   ❌ AUCUN taux trouvé !');
        } else {
            rateRes.rows.forEach(row => {
                console.log(`   ✅ ${row.config_key} = ${row.config_value}`);
            });
        }
        
        // 4. Vérifier colonnes transactions_tiers_payant
        console.log('\n4. Colonnes nécessaires dans transactions_tiers_payant :');
        const colRes = await pool.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'transactions_tiers_payant' 
             AND column_name IN ('montant_total', 'montant_remise', 'montant_patient', 'status_new', 'convention_id', 'partner_phone', 'patient_phone')`
        );
        const foundCols = colRes.rows.map(r => r.column_name);
        const requiredCols = ['montant_total', 'montant_remise', 'montant_patient', 'status_new', 'convention_id', 'partner_phone', 'patient_phone'];
        requiredCols.forEach(col => {
            if (foundCols.includes(col)) {
                console.log(`   ✅ ${col}`);
            } else {
                console.log(`   ❌ ${col} MANQUANT !`);
            }
        });
        
        // 5. Tester directement le INSERT
        console.log('\n5. Test INSERT direct (sans API) :');
        try {
            await pool.query('BEGIN');
            await pool.query(
                `INSERT INTO transactions_tiers_payant 
                    (partner_phone, patient_phone, convention_id, montant_total, montant_remise, montant_patient, status_new)
                 VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
                ['+242066226116', '+242069735418', 5, 10000, 1500, 8500]
            );
            await pool.query('ROLLBACK');
            console.log('   ✅ INSERT test réussi (rollbacké)');
        } catch (e) {
            await pool.query('ROLLBACK');
            console.log(`   ❌ INSERT test échoué : ${e.message}`);
        }
        
        console.log('\n────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur diagnostic :', error.message);
    } finally {
        await pool.end();
    }
}

diagnose();
