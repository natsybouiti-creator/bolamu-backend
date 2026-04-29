const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkAuditLog() {
    try {
        console.log('🔍 Vérification audit_log\n');
        
        const res = await pool.query(`
            SELECT event_type, actor_phone, target_table, payload, created_at
            FROM audit_log
            WHERE target_table = 'transactions_tiers_payant'
            ORDER BY created_at DESC
            LIMIT 3
        `);
        
        console.log('────────────────────────────────────────────────────────────');
        res.rows.forEach((row, i) => {
            console.log(`\n#${i+1}. ${row.event_type}`);
            console.log(`   actor: ${row.actor_phone}`);
            console.log(`   table: ${row.target_table}`);
            console.log(`   payload: ${row.payload}`);
            console.log(`   created: ${row.created_at}`);
        });
        console.log('\n────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
    } finally {
        await pool.end();
    }
}

checkAuditLog();
