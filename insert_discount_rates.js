const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function insertDiscountRates() {
    try {
        console.log('🔄 Insertion des taux de réduction dans platform_config\n');
        
        await pool.query(`
            INSERT INTO platform_config (config_key, config_value, description) VALUES
            ('discount_rate_pharmacie', '0.15', 'Taux de réduction tiers payant pharmacie (15%)'),
            ('discount_rate_laboratoire', '0.10', 'Taux de réduction tiers payant laboratoire (10%)')
            ON CONFLICT (config_key) DO NOTHING
        `);
        
        console.log('✅ Taux de réduction insérés avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Vérification des taux de réduction :');
        console.log('────────────────────────────────────────────────────────────');
        
        const checkRes = await pool.query(
            `SELECT config_key, config_value FROM platform_config WHERE config_key LIKE 'discount_rate%'`
        );
        
        checkRes.rows.forEach(row => {
            console.log(`  - ${row.config_key} : ${row.config_value}`);
        });
        
        console.log(`\nTotal : ${checkRes.rows.length} clés`);
        console.log('────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

insertDiscountRates();
