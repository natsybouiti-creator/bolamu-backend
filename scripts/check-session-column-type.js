// Vérifier le type de la colonne session
const pool = require('../src/config/db');

async function checkColumnType() {
  try {
    const result = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name='whatsapp_sessions' AND column_name='session'
    `);
    
    console.log('Type de la colonne session:', result.rows[0]?.data_type || 'Non trouvée');
    
    if (result.rows[0]?.data_type === 'text' || result.rows[0]?.data_type === 'character varying') {
      console.log('⚠️  Migration BYTEA requise');
    } else if (result.rows[0]?.data_type === 'bytea') {
      console.log('✅ Déjà BYTEA - OK');
    }
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumnType();
