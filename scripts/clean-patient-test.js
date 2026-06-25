// Nettoyage complet du patient test (+242069735418) avec CASCADE
const pool = require('../src/config/db');

async function cleanPatient() {
  const phone = '+242069735418';
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Récupérer l'ID utilisateur
    const userRes = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (userRes.rows.length === 0) {
      console.log('Patient non trouvé');
      await client.query('ROLLBACK');
      return;
    }
    
    const userId = userRes.rows[0].id;
    console.log('Suppression patient:', phone, '(ID:', userId, ')');
    
    // Suppression avec CASCADE automatique
    await client.query('DELETE FROM users WHERE phone = $1', [phone]);
    
    await client.query('COMMIT');
    console.log('✅ Patient supprimé avec succès (CASCADE)');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanPatient();
