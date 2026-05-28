const pool = require('../src/config/db');

async function checkUser() {
  const result = await pool.query(
    `SELECT phone, role, is_active, statut_abonnement,
     password_hash IS NOT NULL as has_password
     FROM users 
     WHERE phone LIKE '%66226116%' 
     OR phone LIKE '%60000099%'`
  );
  console.log('Users found:', JSON.stringify(result.rows, null, 2));
  await pool.end();
}

checkUser().catch(console.error);
