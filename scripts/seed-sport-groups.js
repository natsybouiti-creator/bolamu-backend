const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function seedSportGroups() {
    try {
        console.log('🌱 Exécution du seed sport_groups...\n');
        
        const sql = fs.readFileSync('./database/migrations/seeds/seed_sport_groups.sql', 'utf8');
        
        await pool.query(sql);
        
        console.log('✅ Seed sport_groups exécuté avec succès\n');
        
        // Vérifier le résultat
        const result = await pool.query('SELECT * FROM sport_groups ORDER BY id');
        console.log(`📊 ${result.rows.length} groupes insérés :`);
        result.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.sport_type})`);
        });
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

seedSportGroups();
