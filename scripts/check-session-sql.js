// Vérification table whatsapp_sessions
const pool = require('../src/config/db');

async function checkSession() {
  try {
    // 1. Vérifier si la table existe
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' AND table_name ILIKE '%session%'
    `);
    
    console.log('=== Tables avec "session" dans le nom ===');
    console.log(tableCheck.rows.map(r => r.table_name).join(', ') || 'Aucune');
    
    // 2. Vérifier les sessions whatsapp
    const sessionCheck = await pool.query(`
      SELECT count(*), max(updated_at) 
      FROM whatsapp_sessions
    `);
    
    console.log('\n=== whatsapp_sessions ===');
    console.log('Nombre de sessions:', sessionCheck.rows[0].count);
    console.log('Dernière mise à jour:', sessionCheck.rows[0].max);
    
    // 3. Détail des sessions
    const sessions = await pool.query(`
      SELECT id, created_at, updated_at, length(session) as session_length
      FROM whatsapp_sessions
      ORDER BY updated_at DESC
    `);
    
    console.log('\n=== Détail sessions ===');
    sessions.rows.forEach(row => {
      console.log(`ID: ${row.id}, Créée: ${row.created_at}, MAJ: ${row.updated_at}, Taille: ${row.session_length} octets`);
    });
    
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkSession();
