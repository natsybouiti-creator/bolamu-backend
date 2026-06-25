// Vérifier le schéma de bolamu_accounts
const pool = require('../src/config/db');

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'bolamu_accounts' 
      ORDER BY ordinal_position
    `);
    
    console.log('=== SCHÉMA TABLE bolamu_accounts ===');
    result.rows.forEach(row => {
      console.log(`${row.column_name} : ${row.data_type}`);
    });
    console.log('=====================================');
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();
