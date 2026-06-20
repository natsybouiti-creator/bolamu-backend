const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkSchema() {
    try {
        console.log('🔍 Vérification du schéma sport_groups...\n');
        
        const columnsResult = await pool.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'sport_groups' AND table_schema = 'public'
            ORDER BY ordinal_position
        `);
        
        console.log('📋 COLONNES DE LA TABLE sport_groups :');
        console.log('─'.repeat(80));
        columnsResult.rows.forEach(col => {
            console.log(`  - ${col.column_name} : ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
        });
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkSchema();
