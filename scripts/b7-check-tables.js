const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkTables() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'entreprises', 'employes', 'contrats_entreprise',
        'wellness_scores', 'icp_scores', 'smartflow_reports',
        'corporate_subscriptions', 'bhp_consents',
        'aggregated_wellness', 'rh_notifications'
      )
      ORDER BY table_name
    `);
    
    console.log('=== TABLES B7 ===\n');
    if (result.rows.length === 0) {
      console.log('Aucune table trouvée');
    } else {
      result.rows.forEach(row => {
        console.log(row.table_name);
      });
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkTables();
