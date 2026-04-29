const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkPharmacie() {
    try {
        console.log('🔍 Vérification compte pharmacie +242066226116\n');
        
        // Vérifier dans users
        const userRes = await pool.query(
            `SELECT phone, role, is_active, password_hash IS NOT NULL as has_password FROM users WHERE phone = '+242066226116'`
        );
        
        console.log('────────────────────────────────────────────────────────────');
        console.log('Table users :');
        console.log('────────────────────────────────────────────────────────────');
        if (userRes.rows.length === 0) {
            console.log('❌ Compte introuvable dans users');
        } else {
            console.log(`  - Phone: ${userRes.rows[0].phone}`);
            console.log(`  - Role: ${userRes.rows[0].role}`);
            console.log(`  - Is active: ${userRes.rows[0].is_active}`);
            console.log(`  - Has password: ${userRes.rows[0].has_password}`);
        }
        
        // Vérifier dans pharmacies
        const pharmaRes = await pool.query(
            `SELECT phone, name, is_active FROM pharmacies WHERE phone = '+242066226116'`
        );
        
        console.log('\n────────────────────────────────────────────────────────────');
        console.log('Table pharmacies :');
        console.log('────────────────────────────────────────────────────────────');
        if (pharmaRes.rows.length === 0) {
            console.log('❌ Pharmacie introuvable');
        } else {
            console.log(`  - Phone: ${pharmaRes.rows[0].phone}`);
            console.log(`  - Name: ${pharmaRes.rows[0].name}`);
            console.log(`  - Is active: ${pharmaRes.rows[0].is_active}`);
        }
        
        console.log('\n────────────────────────────────────────────────────────────');
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkPharmacie();
