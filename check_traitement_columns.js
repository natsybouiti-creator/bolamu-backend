const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkColumns() {
    try {
        console.log('Étape 1 — Vérification des colonnes traitement_en_cours et traitements_en_cours\n');
        
        const result = await pool.query(
            `SELECT column_name, data_type, column_default
             FROM information_schema.columns
             WHERE table_name = 'users'
             AND column_name IN ('traitement_en_cours', 'traitements_en_cours')
             ORDER BY ordinal_position`
        );
        
        console.log('Colonnes trouvées :');
        result.rows.forEach((row, index) => {
            const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
            console.log(`${index + 1}. ${row.column_name.padEnd(25)} : ${row.data_type}${defaultVal}`);
        });
        
        console.log('\nÉtape 2 — Vérification des données dans l\'ancienne colonne\n');
        
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM users WHERE traitement_en_cours IS NOT NULL AND traitement_en_cours != ''`
        );
        
        console.log(`Nombre de lignes avec traitement_en_cours non NULL : ${countResult.rows[0].count}`);
        
        if (parseInt(countResult.rows[0].count) > 0) {
            console.log('\nExemples de données dans traitement_en_cours :');
            const sampleResult = await pool.query(
                `SELECT phone, traitement_en_cours FROM users WHERE traitement_en_cours IS NOT NULL AND traitement_en_cours != '' LIMIT 5`
            );
            sampleResult.rows.forEach(row => {
                console.log(`  ${row.phone}: ${row.traitement_en_cours}`);
            });
        }
        
        console.log('\n────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkColumns();
