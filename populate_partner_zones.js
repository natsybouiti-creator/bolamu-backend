const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function populatePartnerZones() {
    try {
        console.log('🔄 Peuplement partner_zones...\n');
        
        await pool.query(`
            INSERT INTO partner_zones (zone_name, partner_phone, partner_type, is_active)
            VALUES
            ('Plateau', '+242066226116', 'pharmacie', true),
            ('Plateau', '+242068582563', 'laboratoire', true),
            ('Brazzaville', '+242063125478', 'laboratoire', true)
            ON CONFLICT (zone_name, partner_phone, partner_type) DO NOTHING
        `);
        
        console.log('✅ Données insérées avec succès !\n');
        
        // Vérification
        console.log('────────────────────────────────────────────────────────────');
        console.log('Contenu de partner_zones :');
        console.log('────────────────────────────────────────────────────────────');
        
        const checkRes = await pool.query(`SELECT * FROM partner_zones`);
        
        checkRes.rows.forEach(row => {
            console.log(`  - ${row.zone_name} | ${row.partner_phone} | ${row.partner_type} | active: ${row.is_active}`);
        });
        
        console.log(`\nTotal : ${checkRes.rows.length} zones`);
        console.log('────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

populatePartnerZones();
