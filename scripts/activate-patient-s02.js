const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function activatePatient() {
  const patientPhone = '+242069735418';
  
  try {
    // Vérifier statut actuel
    const checkRes = await pool.query(
      'SELECT phone, full_name, role, is_active, banned FROM users WHERE phone = $1',
      [patientPhone]
    );
    
    if (checkRes.rows.length === 0) {
      console.log('❌ Patient introuvable:', patientPhone);
      return;
    }
    
    console.log('📋 Statut actuel:', checkRes.rows[0]);
    
    // Activer le compte et retirer le banned
    const updateRes = await pool.query(
      'UPDATE users SET is_active = TRUE, banned = FALSE, ban_reason = NULL, banned_at = NULL WHERE phone = $1 RETURNING phone, full_name, role, is_active, banned',
      [patientPhone]
    );
    
    console.log('✅ Patient activé:', updateRes.rows[0]);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await pool.end();
  }
}

activatePatient();
