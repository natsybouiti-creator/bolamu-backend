const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuveLot1() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT table_name, COUNT(*) as nb_colonnes
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name IN ('icp_scores', 'smartflow_reports')
      GROUP BY table_name
    `);
    
    console.log('=== PREUVE LOT 1 ===\n');
    if (result.rows.length === 0) {
      console.log('❌ FAIL: Aucune table trouvée');
    } else {
      result.rows.forEach(row => {
        console.log(`${row.table_name}: ${row.nb_colonnes} colonnes`);
      });
      if (result.rows.length === 2) {
        console.log('\n✓ PASS: 2 tables créées');
      } else {
        console.log(`\n❌ FAIL: ${result.rows.length}/2 tables`);
      }
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

preuveLot1();
