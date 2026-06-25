const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuveClearing() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO clearing_transactions
       (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
       VALUES ('+242065207274', 'pharmacie', 1, 'ordonnance', 2500.00, 'pending')
       RETURNING id`
    );
    
    console.log('✓ Clearing transaction insérée (ID:', result.rows[0].id, ')');
    
    const checkResult = await client.query(
      `SELECT id, partner_phone, amount_fcfa, status
       FROM clearing_transactions
       WHERE partner_type = 'pharmacie'`
    );
    
    console.log('\n=== PREUVE CLEARING ===');
    checkResult.rows.forEach(row => {
      console.log(`ID: ${row.id}, Phone: ${row.partner_phone}, Amount: ${row.amount_fcfa}, Status: ${row.status}`);
    });
    
    await client.query('ROLLBACK');
    console.log('\n✓ Rollback effectué (test uniquement)');
  } catch (error) {
    console.error('❌ Erreur preuve clearing:', error.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
}

preuveClearing();
