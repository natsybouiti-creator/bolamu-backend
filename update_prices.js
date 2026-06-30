const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updatePrices() {
  try {
    console.log('Mise à jour price_standard...');
    await pool.query(
      "UPDATE platform_config SET config_value = '5000' WHERE config_key = 'price_standard'"
    );
    console.log('✅ price_standard mis à jour à 5000');

    console.log('Mise à jour price_standard_annual...');
    await pool.query(
      "UPDATE platform_config SET config_value = '60000' WHERE config_key = 'price_standard_annual'"
    );
    console.log('✅ price_standard_annual mis à jour à 60000');

    console.log('\nVérification des prix :');
    const res = await pool.query(
      "SELECT config_key, config_value FROM platform_config WHERE config_key LIKE 'price_%' ORDER BY config_key"
    );
    console.table(res.rows);

    await pool.end();
  } catch (err) {
    console.error('Erreur:', err);
    process.exit(1);
  }
}

updatePrices();
