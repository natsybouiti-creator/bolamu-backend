const { computeWeeklyLeaderboard } = require('../src/services/leaderboard.service');

async function runCompute() {
  try {
    console.log('🔍 Lancement manuel de computeWeeklyLeaderboard()...\n');
    
    const result = await computeWeeklyLeaderboard();
    
    console.log('✅ Classement hebdo calculé avec succès !');
    console.log(`📊 ${result.count} joueurs classés\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runCompute();
