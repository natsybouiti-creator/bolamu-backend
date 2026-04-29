const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function auditFraudSignals() {
    try {
        console.log('🔍 Audit table fraud_signals\n');
        
        const res = await pool.query(
            `SELECT column_name, data_type, column_default, is_nullable
             FROM information_schema.columns
             WHERE table_name = 'fraud_signals'
             ORDER BY ordinal_position`
        );
        
        console.log('────────────────────────────────────────────────────────────');
        console.log('Colonnes de fraud_signals :');
        console.log('────────────────────────────────────────────────────────────');
        res.rows.forEach((row, index) => {
            const nullable = row.is_nullable === 'NO' ? 'NOT NULL' : 'NULL';
            const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
            console.log(`${index + 1}. ${row.column_name.padEnd(25)} : ${row.data_type.padEnd(20)} ${nullable}${defaultVal}`);
        });
        console.log(`\nTotal : ${res.rows.length} colonnes`);
        
        // Chercher fraud_score spécifiquement
        const fraudScoreCol = res.rows.find(r => r.column_name === 'fraud_score');
        if (fraudScoreCol) {
            console.log('\n✅ Colonne fraud_score TROUVÉE');
        } else {
            console.log('\n❌ Colonne fraud_score MANQUANTE');
        }
        
        console.log('────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
    } finally {
        await pool.end();
    }
}

auditFraudSignals();
