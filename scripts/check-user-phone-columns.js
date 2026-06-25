// Vérifier quelles tables ont la colonne user_phone
const pool = require('../src/config/db');

async function checkColumns() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.columns 
      WHERE column_name = 'user_phone' 
      AND table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('=== TABLES AVEC COLONNE user_phone ===');
    result.rows.forEach(row => {
      console.log(row.table_name);
    });
    console.log('=====================================');
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
