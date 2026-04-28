const pool = require('./src/config/db');

async function addGpsColumns() {
  await pool.query(`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS address TEXT;
  `);
  console.log('✅ users — latitude, longitude, address ajoutés');

  await pool.query(`
    ALTER TABLE doctors 
    ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS address TEXT;
  `);
  console.log('✅ doctors — latitude, longitude, address ajoutés');

  await pool.query(`
    ALTER TABLE pharmacies 
    ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS address TEXT;
  `);
  console.log('✅ pharmacies — latitude, longitude, address ajoutés');

  await pool.query(`
    ALTER TABLE laboratories 
    ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS longitude DECIMAL(10,7),
    ADD COLUMN IF NOT EXISTS address TEXT;
  `);
  console.log('✅ laboratories — latitude, longitude, address ajoutés');

  process.exit(0);
}
addGpsColumns().catch(console.error);
