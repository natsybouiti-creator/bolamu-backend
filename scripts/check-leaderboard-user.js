const pool = require('../src/config/db');

async function checkLeaderboardUser() {
  try {
    console.log('🔍 Vérification du joueur dans leaderboard_weekly...\n');
    
    const result = await pool.query(`
      SELECT phone, first_name, last_name, full_name 
      FROM users 
      WHERE phone = (SELECT phone FROM leaderboard_weekly LIMIT 1)
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Aucun utilisateur trouvé');
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log('📊 Données utilisateur :');
    console.log(`  phone: ${user.phone}`);
    console.log(`  first_name: ${user.first_name}`);
    console.log(`  last_name: ${user.last_name}`);
    console.log(`  full_name: ${user.full_name}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

checkLeaderboardUser();
