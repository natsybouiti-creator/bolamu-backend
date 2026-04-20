require('dotenv').config();
const pool = require('./src/config/db');

async function checkPhone() {
    try {
        console.log('=== VÉRIFICATION NUMÉROS UTILISATEURS ===\n');
        
        // Chercher tous les utilisateurs avec des numéros contenant 69735418
        const result = await pool.query(`
            SELECT id, phone, role, full_name, created_at 
            FROM users 
            WHERE phone LIKE '%69735418%'
            ORDER BY created_at DESC
        `);
        
        console.log(`Trouvé ${result.rows.length} utilisateur(s) avec ce numéro :\n`);
        result.rows.forEach(user => {
            console.log(`ID: ${user.id}`);
            console.log(`Phone: "${user.phone}"`);
            console.log(`Role: ${user.role}`);
            console.log(`Full Name: ${user.full_name}`);
            console.log(`Created: ${user.created_at}`);
            console.log('---');
        });
        
        // Afficher tous les formats de téléphone uniques
        const phoneFormats = await pool.query(`
            SELECT DISTINCT phone, COUNT(*) 
            FROM users 
            GROUP BY phone 
            ORDER BY COUNT(*) DESC
            LIMIT 20
        `);
        
        console.log('\n=== 20 NUMÉROS LES PLUS FRÉQUENTS ===\n');
        phoneFormats.rows.forEach(row => {
            console.log(`"${row.phone}" : ${row.count} utilisateur(s)`);
        });
        
    } catch (error) {
        console.error('Erreur:', error);
    } finally {
        await pool.end();
        console.log('\n=== TERMINÉ ===');
    }
}

checkPhone();
