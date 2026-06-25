const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runProof() {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM sport_groups WHERE is_active = true) as groupes_actifs,
        (SELECT COUNT(*) FROM messages) as messages_total,
        (SELECT COUNT(*) FROM leaderboard_weekly WHERE week_start = date_trunc('week', NOW())::date) as classements_semaine,
        (SELECT COUNT(*) FROM leaderboard_encouragements) as encouragements,
        (SELECT COUNT(*) FROM conversations) as conversations
    `);
    
    console.log('PREUVE SQL — Communauté & Engagement');
    console.log('=====================================');
    console.log('Groupes actifs:', result.rows[0].groupes_actifs);
    console.log('Messages total:', result.rows[0].messages_total);
    console.log('Classements semaine:', result.rows[0].classements_semaine);
    console.log('Encouragements:', result.rows[0].encouragements);
    console.log('Conversations:', result.rows[0].conversations);
    console.log('=====================================');
  } catch (error) {
    console.error('❌ Erreur preuve SQL:', error.message);
  } finally {
    await pool.end();
  }
}

runProof();
