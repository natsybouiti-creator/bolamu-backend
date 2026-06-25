const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuve5Tables() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT table_name, COUNT(*) as nb_colonnes
       FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name IN (
         'zora_vouchers', 'zora_games', 'zora_game_plays',
         'partner_vouchers', 'partner_validations'
       )
       GROUP BY table_name
       ORDER BY table_name`
    );
    
    console.log('=== PREUVE 5 TABLES B6 ===\n');
    if (result.rows.length < 5) {
      console.log('❌ FAIL: Moins de 5 tables trouvées');
      console.log(`Tables trouvées: ${result.rows.length}/5`);
    } else {
      console.log('✓ PASS: 5 tables trouvées');
      result.rows.forEach(row => {
        console.log(`  ${row.table_name}: ${row.nb_colonnes} colonnes`);
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

preuve5Tables();
