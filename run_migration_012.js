const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔄 Exécution migration_012_cleanup_transactions.sql...\n');
        
        const migrationSQL = fs.readFileSync('./database/migration_012_cleanup_transactions.sql', 'utf8');
        
        await pool.query(migrationSQL);
        
        console.log('✅ Migration 012 exécutée avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Colonnes restantes après nettoyage :');
        console.log('────────────────────────────────────────────────────────────');
        
        const checkRes = await pool.query(
            `SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = 'transactions_tiers_payant'
             ORDER BY ordinal_position`
        );
        
        checkRes.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.column_name.padEnd(30)} : ${row.data_type}`);
        });
        
        console.log(`\nTotal : ${checkRes.rows.length} colonnes`);
        console.log('────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
