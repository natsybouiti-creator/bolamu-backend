const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function createConventions() {
    try {
        console.log('🔄 Création des conventions partenaires de test...\n');
        
        await pool.query(`
            WITH rates AS (
                SELECT 
                    MAX(CASE WHEN config_key = 'discount_rate_pharmacie' THEN config_value::numeric END) as rate_pharmacie,
                    MAX(CASE WHEN config_key = 'discount_rate_laboratoire' THEN config_value::numeric END) as rate_laboratoire
                FROM platform_config
                WHERE config_key IN ('discount_rate_pharmacie', 'discount_rate_laboratoire')
            )
            INSERT INTO partner_conventions 
                (partner_phone, partner_type, partner_name, status_new, discount_rate, started_at, validated_at, validated_by)
            SELECT '+242066226116', 'pharmacie', 'Phamarcie Mavré', 'actif'::convention_status, rate_pharmacie, NOW(), NOW(), '+242060000099'
            FROM rates
            UNION ALL
            SELECT '+242068582563', 'laboratoire', 'Labo Bioanalyse', 'actif'::convention_status, rate_laboratoire, NOW(), NOW(), '+242060000099'
            FROM rates
            UNION ALL
            SELECT '+242063125478', 'laboratoire', 'LAbo BIoB', 'actif'::convention_status, rate_laboratoire, NOW(), NOW(), '+242060000099'
            FROM rates
            ON CONFLICT DO NOTHING
        `);
        
        console.log('✅ Conventions créées avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Conventions créées :');
        console.log('────────────────────────────────────────────────────────────');
        
        const checkRes = await pool.query(`
            SELECT id, partner_phone, partner_type, status_new, discount_rate, started_at 
            FROM partner_conventions 
            ORDER BY created_at DESC
        `);
        
        checkRes.rows.forEach(row => {
            console.log(`  - ID ${row.id} | ${row.partner_phone} | ${row.partner_type} | status: ${row.status_new} | rate: ${row.discount_rate} | started: ${row.started_at}`);
        });
        
        console.log(`\nTotal : ${checkRes.rows.length} conventions`);
        console.log('────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

createConventions();
