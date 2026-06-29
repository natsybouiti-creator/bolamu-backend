const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkSubscription() {
  const patientPhone = '+242069735418';
  
  try {
    // Vérifier les abonnements du patient
    const subRes = await pool.query(
      'SELECT * FROM subscriptions WHERE patient_phone = $1 ORDER BY created_at DESC LIMIT 5',
      [patientPhone]
    );
    
    console.log('📋 Abonnements du patient:', subRes.rows);
    
    // Vérifier le statut utilisateur
    const userRes = await pool.query(
      'SELECT phone, full_name, role, is_active, banned FROM users WHERE phone = $1',
      [patientPhone]
    );
    
    console.log('👤 Statut utilisateur:', userRes.rows[0]);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  } finally {
    await pool.end();
  }
}

checkSubscription();
