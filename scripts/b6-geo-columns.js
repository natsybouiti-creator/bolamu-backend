const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function checkColumns() {
  const client = await pool.connect();
  try {
    const ledgerResult = await client.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'public'
       AND table_name = 'zora_ledger'
       ORDER BY ordinal_position`
    );
    
    const pointsResult = await client.query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_schema = 'public'
       AND table_name = 'zora_points'
       ORDER BY ordinal_position`
    );
    
    console.log('=== COLONNES zora_ledger ===');
    ledgerResult.rows.forEach(row => {
      console.log(`  ${row.column_name}`);
    });
    
    console.log('\n=== COLONNES zora_points ===');
    pointsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}`);
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkColumns();
