const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkDatabase() {
    try {
        console.log('🔍 Vérification en base — transactions_tiers_payant\n');
        
        const res = await pool.query(`
            SELECT id, patient_phone, partner_phone, montant_total, 
                   montant_remise, montant_patient, discount_rate_used, 
                   status_new, validated_at
            FROM transactions_tiers_payant
            ORDER BY created_at DESC
            LIMIT 3
        `);
        
        console.log('────────────────────────────────────────────────────────────');
        res.rows.forEach((row, i) => {
            console.log(`\nTransaction #${row.id}:`);
            console.log(`  patient_phone: ${row.patient_phone}`);
            console.log(`  partner_phone: ${row.partner_phone}`);
            console.log(`  montant_total: ${row.montant_total} FCFA`);
            console.log(`  montant_remise: ${row.montant_remise} FCFA`);
            console.log(`  montant_patient: ${row.montant_patient} FCFA`);
            console.log(`  discount_rate_used: ${row.discount_rate_used}`);
            console.log(`  status_new: ${row.status_new}`);
            console.log(`  validated_at: ${row.validated_at || 'NULL'}`);
        });
        console.log('\n────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
    } finally {
        await pool.end();
    }
}

checkDatabase();
