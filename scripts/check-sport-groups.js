const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkSportGroups() {
    try {
        console.log('🔍 Vérification de la table sport_groups...\n');
        
        // Vérifier si la table existe
        const tableCheck = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'sport_groups'
        `);
        
        if (tableCheck.rows.length === 0) {
            console.log('❌ Table sport_groups N\'EXISTE PAS en base');
            return;
        }
        
        console.log('✅ Table sport_groups existe\n');
        
        // Compter les lignes
        const countResult = await pool.query('SELECT COUNT(*) as count FROM sport_groups');
        console.log(`📊 Nombre de groupes : ${countResult.rows[0].count}\n`);
        
        // Afficher les groupes
        const groupsResult = await pool.query('SELECT * FROM sport_groups ORDER BY id');
        
        console.log('📋 GROUPES DANS LA BASE :');
        console.log('─'.repeat(80));
        
        if (groupsResult.rows.length === 0) {
            console.log('  (table vide)');
        } else {
            groupsResult.rows.forEach(row => {
                console.log(`  ID: ${row.id} | ${row.name} | ${row.sport_type} | ${row.city} | ${row.member_count} membres`);
            });
        }
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkSportGroups();
