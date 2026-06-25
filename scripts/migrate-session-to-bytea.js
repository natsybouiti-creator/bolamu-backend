// Migration session TEXT → BYTEA
const pool = require('../src/config/db');

async function migrateToBytea() {
  try {
    console.log('1. Purge table...');
    await pool.query('DELETE FROM whatsapp_sessions');
    
    console.log('2. Migration colonne session vers BYTEA...');
    await pool.query(`
      ALTER TABLE whatsapp_sessions 
      ALTER COLUMN session TYPE BYTEA 
      USING session::bytea
    `);
    
    console.log('✅ Migration terminée');
    
    // Vérification
    const result = await pool.query(`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name='whatsapp_sessions' AND column_name='session'
    `);
    
    console.log('Nouveau type:', result.rows[0].data_type);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

migrateToBytea();
