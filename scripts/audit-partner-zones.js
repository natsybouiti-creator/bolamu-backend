const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function auditPartnerZones() {
    try {
        console.log('🔍 Audit partner_zones et platform_config\n');
        
        // 1. Taux partenaires dans platform_config
        console.log('────────────────────────────────────────────────────────────');
        console.log('1. Taux partenaires dans platform_config :');
        console.log('────────────────────────────────────────────────────────────');
        const rateRes = await pool.query(
            `SELECT config_key, config_value FROM platform_config WHERE config_key LIKE 'partner_rate%'`
        );
        if (rateRes.rows.length === 0) {
            console.log('⚠️  Aucune clé partner_rate_* trouvée dans platform_config');
        } else {
            rateRes.rows.forEach(row => {
                console.log(`  - ${row.config_key} : ${row.config_value}`);
            });
        }
        console.log(`Total : ${rateRes.rows.length} clés\n`);
        
        // 2. Types de partenaires dans partner_zones
        console.log('────────────────────────────────────────────────────────────');
        console.log('2. Types de partenaires dans partner_zones :');
        console.log('────────────────────────────────────────────────────────────');
        const typeRes = await pool.query(
            `SELECT DISTINCT partner_type FROM partner_zones`
        );
        if (typeRes.rows.length === 0) {
            console.log('⚠️  Aucune donnée dans partner_zones');
        } else {
            typeRes.rows.forEach(row => {
                console.log(`  - ${row.partner_type}`);
            });
        }
        console.log(`Total : ${typeRes.rows.length} types distincts\n`);
        
        // 3. Nombre de lignes dans partner_zones
        console.log('────────────────────────────────────────────────────────────');
        console.log('3. Nombre de lignes dans partner_zones :');
        console.log('────────────────────────────────────────────────────────────');
        const countRes = await pool.query(
            `SELECT COUNT(*) FROM partner_zones`
        );
        console.log(`  - Total : ${countRes.rows[0].count} lignes\n`);
        
        console.log('✅ Audit terminé');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

auditPartnerZones();
