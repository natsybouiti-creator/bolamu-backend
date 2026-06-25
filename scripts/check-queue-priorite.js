// Vérifier les valeurs acceptées pour priorite
const pool = require('../src/config/db');

async function checkPriorite() {
  try {
    const result = await pool.query(`
      SELECT check_clause 
      FROM information_schema.check_constraints 
      WHERE constraint_name = 'file_attente_priorite_check'
    `);
    
    console.log('=== CONTRAINTE priorite ===');
    console.log(result.rows[0]?.check_clause || 'Non trouvée');
    console.log('============================');
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkPriorite();
