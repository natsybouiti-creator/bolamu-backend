// ============================================================
// Fix — synchronise la ligne animateurs manquante pour Roger Malanda
// (users.role='animateur' sans ligne animateurs correspondante,
// cassait POST /api/v1/animateur/photo — cf. audit du 15/07/2026)
// ============================================================
const pool = require('../src/config/db');

async function fix() {
  const phone = '+242000000088';
  const user = await pool.query(
    `SELECT full_name FROM users WHERE phone = $1 AND role = 'animateur'`,
    [phone]
  );
  if (!user.rows.length) {
    console.log('Compte introuvable dans users');
    return;
  }
  const result = await pool.query(
    `INSERT INTO animateurs (phone, full_name, is_active, created_at)
     VALUES ($1, $2, TRUE, NOW())
     ON CONFLICT (phone) DO NOTHING
     RETURNING *`,
    [phone, user.rows[0].full_name]
  );
  console.log('Rows inserted:', result.rowCount);
  console.log(JSON.stringify(result.rows, null, 2));

  const verify = await pool.query(`SELECT * FROM animateurs WHERE phone = $1`, [phone]);
  console.log('Verification:', JSON.stringify(verify.rows, null, 2));
}

fix().catch(console.error).finally(() => pool.end());
