const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔄 Exécution migration_010_cleanup_tiers_payant.sql...\n');
        
        const migrationSQL = fs.readFileSync('./database/migration_010_cleanup_tiers_payant.sql', 'utf8');
        
        await pool.query(migrationSQL);
        
        console.log('✅ Migration 010 exécutée avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Vérification de la suppression :');
        console.log('────────────────────────────────────────────────────────────');
        
        const checkRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'transactions_tiers_payant' 
            AND column_name = 'bolamu_share_fcfa'
        `);
        
        if (checkRes.rows.length === 0) {
            console.log('✅ Colonne bolamu_share_fcfa supprimée (non trouvée)');
        } else {
            console.log('❌ Colonne bolamu_share_fcfa encore présente');
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
