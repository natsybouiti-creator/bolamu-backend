const { Pool } = require('pg');
const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
const dbUrlMatch = envContent.match(/^DATABASE_URL=(.+)$/m);
const dbUrl = dbUrlMatch ? dbUrlMatch[1] : null;

if (!dbUrl) {
  console.error('DATABASE_URL non trouvé dans .env');
  process.exit(1);
}

const pool = new Pool({ 
  connectionString: dbUrl, 
  ssl: { rejectUnauthorized: false } 
});

async function deleteFollow() {
  const follower = process.argv[2] || '+24265786548';
  const following = process.argv[3] || '+242065452585';
  
  try {
    await pool.query(
      'DELETE FROM follows WHERE follower_phone = $1 AND following_phone = $2',
      [follower, following]
    );
    console.log(`✅ Follow supprimé : ${follower} → ${following}`);
    
    await pool.query(
      'DELETE FROM follow_requests WHERE requester_phone = $1 AND target_phone = $2',
      [follower, following]
    );
    console.log(`✅ Follow_request supprimé : ${follower} → ${following}`);
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

deleteFollow();
