const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔄 Exécution migration_013_fraud_score.sql...\n');
        
        const migrationSQL = fs.readFileSync('./database/migration_013_fraud_score.sql', 'utf8');
        
        await pool.query(migrationSQL);
        
        console.log('✅ Migration 013 exécutée avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Vérification colonnes fraud_signals :');
        console.log('────────────────────────────────────────────────────────────');
        
        const checkRes = await pool.query(
            `SELECT column_name, data_type, column_default
             FROM information_schema.columns
             WHERE table_name = 'fraud_signals'
             ORDER BY ordinal_position`
        );
        
        checkRes.rows.forEach((row, index) => {
            const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
            console.log(`${index + 1}. ${row.column_name.padEnd(25)} : ${row.data_type}${defaultVal}`);
        });
        
        // Vérifier fraud_score
        const fraudScoreCol = checkRes.rows.find(r => r.column_name === 'fraud_score');
        if (fraudScoreCol) {
            console.log('\n✅ Colonne fraud_score ajoutée avec succès !');
        } else {
            console.log('\n❌ Colonne fraud_score non trouvée');
        }
        
        console.log('\n────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
