const pool = require('../src/config/db');

async function activate() {
  const phone = '+242069735418';
  const result = await pool.query(
    `UPDATE users
     SET is_active = true, validated_at = NOW()
     WHERE phone = $1 AND role = 'patient'
     RETURNING phone, role, is_active, validated_at, statut_abonnement`,
    [phone]
  );
  console.log('Rows updated:', result.rowCount);
  console.log('Result:', JSON.stringify(result.rows, null, 2));
  await pool.end();
}

activate().catch(console.error);
