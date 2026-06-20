const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkEvents() {
    try {
        console.log('🔍 Vérification de la table elonga_events...\n');
        
        const result = await pool.query(`
            SELECT id, title, status, starts_at 
            FROM elonga_events
            ORDER BY starts_at
        `);
        
        console.log('📋 ÉVÉNEMENTS DANS LA BASE :');
        console.log('─'.repeat(80));
        
        if (result.rows.length === 0) {
            console.log('  (table vide)');
        } else {
            result.rows.forEach(row => {
                console.log(`  ID: ${row.id} | ${row.title} | status: ${row.status} | starts_at: ${row.starts_at}`);
            });
        }
        
        console.log(`\nTotal : ${result.rows.length} événements\n`);
        
        // Vérifier le filtre utilisé par l'API
        const filteredResult = await pool.query(`
            SELECT id, title, status, starts_at 
            FROM elonga_events
            WHERE status = 'published' AND starts_at > NOW()
            ORDER BY starts_at
        `);
        
        console.log('📋 ÉVÉNEMENTS FILTRÉS (status=published, starts_at>NOW) :');
        console.log('─'.repeat(80));
        
        if (filteredResult.rows.length === 0) {
            console.log('  (aucun événement correspond au filtre)');
        } else {
            filteredResult.rows.forEach(row => {
                console.log(`  ID: ${row.id} | ${row.title} | status: ${row.status} | starts_at: ${row.starts_at}`);
            });
        }
        
        console.log(`\nTotal après filtre : ${filteredResult.rows.length} événements\n`);
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkEvents();
