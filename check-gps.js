const pool = require('./src/config/db');

async function checkGps() {
  // Colonnes GPS dans users
  const users = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'users' AND column_name IN ('latitude','longitude','address','location','gps','coordinates')
     ORDER BY ordinal_position`
  );
  console.log('=== users — colonnes GPS ===');
  users.rows.forEach(r => console.log('-', r.column_name));

  // Colonnes GPS dans doctors
  const doctors = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'doctors' AND column_name IN ('latitude','longitude','address','location','gps','coordinates','cabinet_address')
     ORDER BY ordinal_position`
  );
  console.log('=== doctors — colonnes GPS ===');
  doctors.rows.forEach(r => console.log('-', r.column_name));

  // Colonnes GPS dans pharmacies
  const pharmacies = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'pharmacies' AND column_name IN ('latitude','longitude','address','location','gps','coordinates')
     ORDER BY ordinal_position`
  );
  console.log('=== pharmacies — colonnes GPS ===');
  pharmacies.rows.forEach(r => console.log('-', r.column_name));

  // Colonnes GPS dans laboratories
  const labs = await pool.query(
    `SELECT column_name FROM information_schema.columns 
     WHERE table_name = 'laboratories' AND column_name IN ('latitude','longitude','address','location','gps','coordinates')
     ORDER BY ordinal_position`
  );
  console.log('=== laboratories — colonnes GPS ===');
  labs.rows.forEach(r => console.log('-', r.column_name));

  process.exit(0);
}
checkGps().catch(console.error);
