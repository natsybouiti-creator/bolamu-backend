const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function insertBolamuGroups() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const groups = [
      { name: 'Football Bacongo', sport: 'Football', description: 'Groupe football du quartier Bacongo', icon: 'sports_soccer' },
      { name: 'Tennis Club PNR', sport: 'Tennis', description: 'Club tennis du Palais National des Raquettes', icon: 'sports_tennis' },
      { name: 'Natation Congo', sport: 'Natation', description: 'Groupe natation de Brazzaville', icon: 'pool' },
      { name: 'Cyclisme Brazza', sport: 'Cyclisme', description: 'Groupe cyclisme de Brazzaville', icon: 'directions_bike' },
      { name: 'Runners Brazza', sport: 'Course', description: 'Groupe course à pied de Brazzaville', icon: 'directions_run' },
      { name: 'Basketball Bacongo', sport: 'Basketball', description: 'Groupe basketball du quartier Bacongo', icon: 'sports_basketball' }
    ];

    const createdBy = '242065207273';

    for (const group of groups) {
      const existing = await client.query(
        'SELECT id FROM sport_groups WHERE name = $1',
        [group.name]
      );
      
      if (existing.rows.length > 0) {
        console.log(`⏭️  Existe déjà: ${group.name}`);
        continue;
      }
      
      const result = await client.query(
        `INSERT INTO sport_groups (name, sport_type, icon_name, color_token, description, city, is_active, created_at)
         VALUES ($1, $2, $3, 'turquoise', $4, 'Brazzaville', true, NOW())
         RETURNING id, name`,
        [group.name, group.sport, group.icon, group.description]
      );
      console.log(`✅ Inséré: ${group.name}`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Insertion terminée avec succès');

    // Vérification
    const result = await client.query(
      `SELECT id, name, sport_type, 
        (SELECT COUNT(*) FROM sport_group_members WHERE group_id = sg.id) as membres
       FROM sport_groups sg
       WHERE is_active = true
       ORDER BY name`
    );
    console.log('\nGroupes actifs avec membres:');
    result.rows.forEach(row => {
      console.log(`  - ${row.id}: ${row.name} (${row.sport_type}) - ${row.membres} membre(s)`);
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

insertBolamuGroups();
