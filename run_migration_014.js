const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔄 Exécution migration_014_constantes_medicales.sql...\n');
        
        const migrationSQL = fs.readFileSync('./database/migration_014_constantes_medicales.sql', 'utf8');
        
        await pool.query(migrationSQL);
        
        console.log('✅ Migration 014 exécutée avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Vérification colonnes constantes médicales dans users :');
        console.log('────────────────────────────────────────────────────────────');
        
        const checkRes = await pool.query(
            `SELECT column_name, data_type, column_default
             FROM information_schema.columns
             WHERE table_name = 'users'
             AND column_name IN ('groupe_sanguin','allergies','maladies_chroniques','antecedents_medicaux','traitements_en_cours','poids','taille','contact_urgence_nom','contact_urgence_phone','contact_urgence_lien','constantes_remplies_par','constantes_updated_at')
             ORDER BY ordinal_position`
        );
        
        checkRes.rows.forEach((row, index) => {
            const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
            console.log(`${index + 1}. ${row.column_name.padEnd(30)} : ${row.data_type}${defaultVal}`);
        });
        
        if (checkRes.rows.length === 12) {
            console.log('\n✅ Toutes les 12 colonnes ajoutées avec succès !');
        } else {
            console.log(`\n⚠️ Seulement ${checkRes.rows.length} colonnes trouvées sur 12 attendues`);
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
