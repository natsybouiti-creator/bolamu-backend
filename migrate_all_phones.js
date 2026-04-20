require('dotenv').config();
const pool = require('./src/config/db');

// Fonction de normalisation inline (même logique que dans auth.controller.js)
function normalizePhoneInline(phone) {
    let normalizedPhone = (phone || '').trim().replace(/\s+/g, '');
    // Supprime le 0 après l'indicatif +242
    normalizedPhone = normalizedPhone.replace(/^(\+242)0(\d{8})$/, '$1$2');
    // Supprime le 0 après tout autre indicatif africain
    normalizedPhone = normalizedPhone.replace(/^(\+\d{2,3})0(\d{7,8})$/, '$1$2');
    // Format local 0XXXXXXXX → +24269XXXXXXXX
    if (/^0\d{8}$/.test(normalizedPhone)) normalizedPhone = '+242' + normalizedPhone.slice(1);
    return normalizedPhone;
}

async function migrateAllPhones() {
    try {
        console.log('=== MIGRATION GLOBALE DES NUMÉROS DE TÉLÉPHONE ===\n');
        
        // Récupérer tous les utilisateurs
        const result = await pool.query(`
            SELECT id, phone, role, full_name 
            FROM users 
            ORDER BY id
        `);
        
        console.log(`Trouvé ${result.rows.length} utilisateur(s) à traiter\n`);
        
        let updatedCount = 0;
        let skippedCount = 0;
        
        for (const user of result.rows) {
            const normalizedPhone = normalizePhoneInline(user.phone);
            
            if (user.phone !== normalizedPhone) {
                await pool.query(`
                    UPDATE users 
                    SET phone = $1 
                    WHERE id = $2
                `, [normalizedPhone, user.id]);
                
                console.log(`✓ ID ${user.id} (${user.role}): "${user.phone}" → "${normalizedPhone}"`);
                updatedCount++;
            } else {
                console.log(`○ ID ${user.id} (${user.role}): "${user.phone}" (déjà normalisé)`);
                skippedCount++;
            }
        }
        
        console.log(`\n=== RÉSUMÉ ===`);
        console.log(`Total utilisateurs : ${result.rows.length}`);
        console.log(`Numéros mis à jour : ${updatedCount}`);
        console.log(`Numéros déjà OK : ${skippedCount}`);
        
        // Vérification finale : afficher les formats uniques
        const formats = await pool.query(`
            SELECT phone, COUNT(*) as count 
            FROM users 
            GROUP BY phone 
            ORDER BY count DESC
            LIMIT 10
        `);
        
        console.log(`\n=== 10 NUMÉROS LES PLUS FRÉQUENTS ===`);
        formats.rows.forEach(row => {
            console.log(`"${row.phone}" : ${row.count} utilisateur(s)`);
        });
        
    } catch (error) {
        console.error('Erreur:', error);
    } finally {
        await pool.end();
        console.log('\n=== MIGRATION TERMINÉE ===');
    }
}

migrateAllPhones();
