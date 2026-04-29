const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function fixDefault() {
    try {
        console.log('🔄 Correction DEFAULT bolamu_share_fcfa...\n');
        
        await pool.query(`
            ALTER TABLE transactions_tiers_payant 
            ALTER COLUMN bolamu_share_fcfa SET DEFAULT 0,
            ALTER COLUMN bolamu_share_fcfa SET NOT NULL
        `);
        
        console.log('✅ DEFAULT corrigé avec succès !\n');
        
        // Vérification
        const checkRes = await pool.query(`
            SELECT column_name, data_type, column_default, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'transactions_tiers_payant' 
            AND column_name = 'bolamu_share_fcfa'
        `);
        
        console.log('────────────────────────────────────────────────────────────');
        console.log('Vérification :');
        console.log('────────────────────────────────────────────────────────────');
        console.log(`  - column_name : ${checkRes.rows[0].column_name}`);
        console.log(`  - data_type : ${checkRes.rows[0].data_type}`);
        console.log(`  - column_default : ${checkRes.rows[0].column_default}`);
        console.log(`  - is_nullable : ${checkRes.rows[0].is_nullable}`);
        console.log('────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

fixDefault();
