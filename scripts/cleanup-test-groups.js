const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function cleanupTestGroups() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const testGroupNames = [
      'Équipe QA', 'Équipe Test', 'Lions FC Test',
      'Test Fraude 1', "Test'; DROP TABLE sport_groups; --"
    ];

    // Supprimer les membres des groupes de test
    const deleteMembers = await client.query(
      `DELETE FROM sport_group_members 
       WHERE group_id IN (
         SELECT id FROM sport_groups 
         WHERE name = ANY($1)
       )`,
      [testGroupNames]
    );
    console.log('Membres supprimés:', deleteMembers.rowCount);

    // Supprimer les conversations des groupes de test
    const deleteConversations = await client.query(
      `DELETE FROM conversations
       WHERE club_id IN (
         SELECT id FROM sport_groups 
         WHERE name = ANY($1)
       )`,
      [testGroupNames]
    );
    console.log('Conversations supprimées:', deleteConversations.rowCount);

    // Supprimer les groupes de test
    const deleteGroups = await client.query(
      `DELETE FROM sport_groups 
       WHERE name = ANY($1)`,
      [testGroupNames]
    );
    console.log('Groupes supprimés:', deleteGroups.rowCount);

    await client.query('COMMIT');
    console.log('✅ Nettoyage terminé avec succès');

    // Vérification
    const result = await client.query(
      'SELECT id, name FROM sport_groups ORDER BY name'
    );
    console.log('\nGroupes restants en base:');
    result.rows.forEach(row => {
      console.log(`  - ${row.id}: ${row.name}`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupTestGroups();
