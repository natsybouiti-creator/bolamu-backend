require('dotenv').config();
const pool = require('./src/config/db');

async function fixPhone() {
    try {
        console.log('=== NORMALISATION DES NUMÉROS UTILISATEURS ===\n');
        
        // Mettre à jour le numéro de l'utilisateur ID 1
        const result = await pool.query(`
            UPDATE users 
            SET phone = '+24269735418' 
            WHERE id = 1
            RETURNING id, phone, full_name
        `);
        
        console.log('Utilisateur mis à jour :');
        console.log(`ID: ${result.rows[0].id}`);
        console.log(`Phone: "${result.rows[0].phone}"`);
        console.log(`Full Name: ${result.rows[0].full_name}`);
        
        // Vérifier
        const check = await pool.query(`
            SELECT * FROM users WHERE phone = '+24269735418'
        `);
        console.log(`\nVérification : ${check.rows.length} utilisateur(s) trouvé(s) avec +24269735418`);
        
    } catch (error) {
        console.error('Erreur:', error);
    } finally {
        await pool.end();
        console.log('\n=== TERMINÉ ===');
    }
}

fixPhone();
