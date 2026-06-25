const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('render') ? { rejectUnauthorized: false } : false
});

async function checkTables() {
  try {
    console.log('=== Vérification tables communauté ===\n');
    
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'conversations', 'messages', 'sport_groups', 'sport_group_members',
        'clubs', 'club_members', 'leaderboard_weekly', 'user_streaks'
      )
    `);
    
    console.log('Tables existantes:', result.rows.length);
    result.rows.forEach(row => {
      console.log('  -', row.table_name);
    });
    
    const expectedTables = ['conversations', 'messages', 'sport_groups', 'sport_group_members', 'clubs', 'club_members', 'leaderboard_weekly', 'user_streaks'];
    const missingTables = expectedTables.filter(t => !result.rows.find(r => r.table_name === t));
    
    if (missingTables.length > 0) {
      console.log('\nTables manquantes:', missingTables);
    } else {
      console.log('\n✓ Toutes les tables existent');
    }
    
    await pool.end();
  } catch (err) {
    console.error('Erreur:', err.message);
    await pool.end();
    process.exit(1);
  }
}

checkTables();
