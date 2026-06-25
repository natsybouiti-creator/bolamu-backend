// ÉTAPE 1 - Purger la session morte
const pool = require('../src/config/db');

async function purgeSession() {
  try {
    await pool.query(
      "DELETE FROM whatsapp_sessions WHERE id = '{\"session\":\"RemoteAuth\"}'"
    );
    
    const count = await pool.query('SELECT count(*) FROM whatsapp_sessions');
    
    console.log('✅ Session purgée');
    console.log('Sessions restantes:', count.rows[0].count);
    
    if (parseInt(count.rows[0].count) === 0) {
      console.log('✅ Table vide - prête pour nouvelle session');
    }
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

purgeSession();
