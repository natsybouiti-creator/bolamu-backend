const pool = require('../src/config/db');

async function checkWeeklyZora() {
  try {
    console.log('🔍 Vérification des points Zora cette semaine...\n');
    
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM zora_ledger 
      WHERE earned_at >= date_trunc('week', NOW()) 
      AND points > 0
    `);
    
    const count = parseInt(result.rows[0].count);
    console.log(`📊 Nombre d'entrées Zora cette semaine : ${count}\n`);
    
    if (count > 0) {
      console.log('✅ Il y a des points cette semaine.');
      console.log('💡 Le leaderboard vide confirme que le cron n\'a pas encore tourné.');
      console.log('💡 Optionnel : lancer computeWeeklyLeaderboard() manuellement.');
    } else {
      console.log('✅ Normal : personne n\'a encore gagné de Zora cette semaine.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

checkWeeklyZora();
