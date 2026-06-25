const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function cleanupTestData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // CORRECTION 2 - Nettoyer les événements de test
    // D'abord supprimer les tokens de check-in des événements de test
    const deleteTokens = await client.query(
      `DELETE FROM elonga_checkin_tokens 
       WHERE event_id IN (
         SELECT id FROM elonga_events 
         WHERE title LIKE '%Playwright%' 
         OR title LIKE '%Test%'
       )`
    );
    console.log('Tokens check-in événements de test supprimés:', deleteTokens.rowCount);

    // Ensuite supprimer les inscriptions aux événements de test
    const deleteRegistrations = await client.query(
      `DELETE FROM elonga_registrations 
       WHERE event_id IN (
         SELECT id FROM elonga_events 
         WHERE title LIKE '%Playwright%' 
         OR title LIKE '%Test%'
       )`
    );
    console.log('Inscriptions événements de test supprimées:', deleteRegistrations.rowCount);

    // Enfin supprimer les événements de test
    const deleteEvents = await client.query(
      `DELETE FROM elonga_events 
       WHERE title LIKE '%Playwright%' 
       OR title LIKE '%Test%'`
    );
    console.log('Événements de test supprimés:', deleteEvents.rowCount);

    // CORRECTION 3 - Corriger le solde Zora -500
    const updateZora = await client.query(
      `UPDATE zora_points 
       SET balance = (
         SELECT COALESCE(SUM(points), 0) 
         FROM zora_ledger 
         WHERE phone = '242069735418'
       ) 
       WHERE phone = '242069735418'`
    );
    console.log('Solde Zora corrigé:', updateZora.rowCount);

    // Vérification
    const zoraCheck = await client.query(
      'SELECT balance FROM zora_points WHERE phone = $1',
      ['242069735418']
    );
    if (zoraCheck.rows.length > 0) {
      console.log('Nouveau solde Zora:', zoraCheck.rows[0].balance);
    }

    await client.query('COMMIT');
    console.log('✅ Nettoyage terminé avec succès');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupTestData();
