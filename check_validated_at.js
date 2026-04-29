const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkValidatedAt() {
    try {
        console.log('🔍 Vérification colonne validated_at dans users\n');
        
        const res = await pool.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'users' AND column_name = 'validated_at'`
        );
        
        if (res.rows.length > 0) {
            console.log('✅ La colonne validated_at EXISTS dans users');
            console.log('   → Suppression du code de boot possible');
        } else {
            console.log('❌ La colonne validated_at N\'EXISTE PAS dans users');
            console.log('   → STOPPER : ne pas supprimer le code de boot');
        }
        
    } catch (error) {
        console.error('❌ Erreur :', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

checkValidatedAt();
