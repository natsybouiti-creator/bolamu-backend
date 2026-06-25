// Vérifier la table zora_points
const pool = require('../src/config/db');

async function checkZoraPoints() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'zora_points' 
      ORDER BY ordinal_position
    `);
    
    console.log('=== SCHÉMA TABLE zora_points ===');
    result.rows.forEach(row => {
      console.log(`${row.column_name} : ${row.data_type}`);
    });
    console.log('==================================');
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkZoraPoints();
