const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔄 Exécution migration_015_remove_traitement_en_cours.sql...\n');
        
        const migrationSQL = fs.readFileSync('./database/migration_015_remove_traitement_en_cours.sql', 'utf8');
        
        await pool.query(migrationSQL);
        
        console.log('✅ Migration 015 exécutée avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Vérification colonnes traitement% dans users :');
        console.log('────────────────────────────────────────────────────────────');
        
        const checkRes = await pool.query(
            `SELECT column_name, data_type
             FROM information_schema.columns
             WHERE table_name = 'users'
             AND column_name LIKE 'traitement%'
             ORDER BY column_name`
        );
        
        checkRes.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.column_name.padEnd(30)} : ${row.data_type}`);
        });
        
        if (checkRes.rows.length === 1 && checkRes.rows[0].column_name === 'traitements_en_cours') {
            console.log('\n✅ Une seule colonne traitements_en_cours trouvée — doublon supprimé !');
        } else {
            console.log(`\n⚠️ ${checkRes.rows.length} colonne(s) trouvée(s) — vérification requise`);
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
