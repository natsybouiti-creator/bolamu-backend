const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkColumns() {
    try {
        console.log('🔍 Vérification colonnes transactions_tiers_payant\n');
        
        const res = await pool.query(
            `SELECT column_name, data_type 
             FROM information_schema.columns 
             WHERE table_name = 'transactions_tiers_payant'
             ORDER BY ordinal_position`
        );
        
        console.log('────────────────────────────────────────────────────────────');
        console.log('Colonnes actuelles :');
        console.log('────────────────────────────────────────────────────────────');
        res.rows.forEach(row => {
            console.log(`  - ${row.column_name} : ${row.data_type}`);
        });
        console.log(`\nTotal : ${res.rows.length} colonnes\n`);
        
        // Vérifier les colonnes nécessaires
        const requiredColumns = ['montant_total', 'montant_remise', 'montant_patient'];
        const existingColumns = res.rows.map(row => row.column_name);
        
        console.log('────────────────────────────────────────────────────────────');
        console.log('Vérification colonnes requises :');
        console.log('────────────────────────────────────────────────────────────');
        
        const missingColumns = [];
        requiredColumns.forEach(col => {
            if (existingColumns.includes(col)) {
                console.log(`  ✅ ${col} : EXISTS`);
            } else {
                console.log(`  ❌ ${col} : MISSING`);
                missingColumns.push(col);
            }
        });
        
        if (missingColumns.length > 0) {
            console.log(`\n⚠️  Colonnes manquantes : ${missingColumns.join(', ')}`);
            console.log('   → Créer migration_011_transactions_colonnes.sql');
        } else {
            console.log('\n✅ Toutes les colonnes requises existent');
        }
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkColumns();
