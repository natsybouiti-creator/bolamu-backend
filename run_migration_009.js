const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runMigration() {
    try {
        console.log('🔄 Exécution migration_009_fix_enum_and_qr.sql...\n');
        
        const migrationSQL = fs.readFileSync('./database/migration_009_fix_enum_and_qr.sql', 'utf8');
        
        await pool.query(migrationSQL);
        
        console.log('✅ Migration 009 exécutée avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Vérification des modifications :');
        console.log('────────────────────────────────────────────────────────────');
        
        // 1. Vérifier ENUM partner_zone_type
        const enumRes = await pool.query(`
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = 'partner_zone_type'::regtype 
            ORDER BY enumsortorder
        `);
        console.log('1. Valeurs ENUM partner_zone_type :');
        enumRes.rows.forEach(row => {
            console.log(`   - ${row.enumlabel}`);
        });
        
        // 2. Vérifier colonne fee_per_adherent supprimée
        const columnsRes = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'partner_zones' 
            AND column_name = 'fee_per_adherent'
        `);
        console.log('\n2. Colonne fee_per_adherent dans partner_zones :');
        if (columnsRes.rows.length === 0) {
            console.log('   ✅ Supprimée (non trouvée)');
        } else {
            console.log('   ❌ Encore présente');
        }
        
        // 3. Vérifier colonne bolamu_share_fcfa ajoutée
        const bolamuRes = await pool.query(`
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'transactions_tiers_payant' 
            AND column_name = 'bolamu_share_fcfa'
        `);
        console.log('\n3. Colonne bolamu_share_fcfa dans transactions_tiers_payant :');
        if (bolamuRes.rows.length > 0) {
            console.log(`   ✅ Ajoutée : ${bolamuRes.rows[0].data_type} DEFAULT ${bolamuRes.rows[0].column_default}`);
        } else {
            console.log('   ❌ Non trouvée');
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
