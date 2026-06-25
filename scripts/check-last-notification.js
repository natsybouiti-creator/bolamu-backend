// Vérifier la dernière notification
const pool = require('../src/config/db');

async function checkLastNotification() {
  try {
    const result = await pool.query(`
      SELECT id, titre, message, sent_at 
      FROM notifications 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    console.log('=== DERNIÈRE NOTIFICATION ===');
    console.log('ID:', result.rows[0].id);
    console.log('Titre:', result.rows[0].titre);
    console.log('Message:', result.rows[0].message);
    console.log('Sent_at:', result.rows[0].sent_at);
    console.log('============================');
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkLastNotification();
