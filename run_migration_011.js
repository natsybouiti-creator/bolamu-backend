const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔄 Exécution migration_011_transactions_colonnes.sql...\n');
        
        const migrationSQL = fs.readFileSync('./database/migration_011_transactions_colonnes.sql', 'utf8');
        
        await pool.query(migrationSQL);
        
        console.log('✅ Migration 011 exécutée avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Vérification des colonnes ajoutées :');
        console.log('────────────────────────────────────────────────────────────');
        
        const checkRes = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'transactions_tiers_payant' 
            AND column_name IN ('montant_total', 'montant_remise', 'montant_patient')
            ORDER BY column_name
        `);
        
        checkRes.rows.forEach(row => {
            console.log(`  - ${row.column_name} : ${row.data_type} DEFAULT ${row.column_default}`);
        });
        
        console.log(`\nTotal : ${checkRes.rows.length} colonnes ajoutées`);
        console.log('────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur lors de la migration :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
