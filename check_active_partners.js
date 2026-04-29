const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkActivePartners() {
    try {
        console.log('🔍 Vérification partenaires actifs disponibles\n');
        
        // Pharmacies actives
        console.log('────────────────────────────────────────────────────────────');
        console.log('Pharmacies actives :');
        console.log('────────────────────────────────────────────────────────────');
        const pharmaRes = await pool.query(
            `SELECT p.phone, p.name, p.neighborhood, p.city, p.is_active
             FROM pharmacies p WHERE p.is_active = true`
        );
        
        if (pharmaRes.rows.length === 0) {
            console.log('⚠️  Aucune pharmacie active trouvée');
        } else {
            pharmaRes.rows.forEach(row => {
                console.log(`  - ${row.phone} | ${row.name} | ${row.neighborhood || 'N/A'} | ${row.city || 'N/A'}`);
            });
        }
        console.log(`Total : ${pharmaRes.rows.length} pharmacies actives\n`);
        
        // Laboratoires actifs
        console.log('────────────────────────────────────────────────────────────');
        console.log('Laboratoires actifs :');
        console.log('────────────────────────────────────────────────────────────');
        const labRes = await pool.query(
            `SELECT l.phone, l.name, l.neighborhood, l.city, l.is_active
             FROM laboratories l WHERE l.is_active = true`
        );
        
        if (labRes.rows.length === 0) {
            console.log('⚠️  Aucun laboratoire actif trouvé');
        } else {
            labRes.rows.forEach(row => {
                console.log(`  - ${row.phone} | ${row.name} | ${row.neighborhood || 'N/A'} | ${row.city || 'N/A'}`);
            });
        }
        console.log(`Total : ${labRes.rows.length} laboratoires actifs\n`);
        
        console.log('────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkActivePartners();
