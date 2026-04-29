const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function auditColumns() {
    try {
        console.log('🔍 Audit complet colonnes transactions_tiers_payant\n');
        
        const res = await pool.query(
            `SELECT column_name, data_type, column_default
             FROM information_schema.columns
             WHERE table_name = 'transactions_tiers_payant'
             ORDER BY ordinal_position`
        );
        
        console.log('────────────────────────────────────────────────────────────');
        console.log('Colonnes actuelles :');
        console.log('────────────────────────────────────────────────────────────');
        res.rows.forEach((row, index) => {
            const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
            console.log(`${index + 1}. ${row.column_name.padEnd(30)} : ${row.data_type.padEnd(20)}${defaultVal}`);
        });
        console.log(`\nTotal : ${res.rows.length} colonnes\n`);
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

auditColumns();
