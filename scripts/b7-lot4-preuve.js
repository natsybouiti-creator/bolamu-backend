const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuveFinale() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM company_employees
         WHERE status = 'active') as employes_actifs,
        (SELECT COUNT(*) FROM icp_scores) as rapports_icp,
        (SELECT COUNT(*) FROM smartflow_reports) as rapports_smartflow,
        (SELECT COUNT(*) FROM wellness_actions) as actions_wellness
    `);
    
    console.log('=== PREUVE FINALE BOUCLE 7 ===\n');
    const row = result.rows[0];
    console.log(`employes_actifs: ${row.employes_actifs}`);
    console.log(`rapports_icp: ${row.rapports_icp}`);
    console.log(`rapports_smartflow: ${row.rapports_smartflow}`);
    console.log(`actions_wellness: ${row.actions_wellness}`);
    
    if (row.rapports_icp >= 1 && row.rapports_smartflow >= 1) {
      console.log('\n✓ PASS: rapports_icp ≥ 1, rapports_smartflow ≥ 1');
    } else {
      console.log('\n❌ FAIL: rapports_icp ou rapports_smartflow = 0');
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

preuveFinale();
