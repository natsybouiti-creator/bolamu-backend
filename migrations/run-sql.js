// Runner SQL générique : node migrations/run-sql.js <chemin_fichier.sql>
// Utilise la connexion Neon de src/config/db.js (DATABASE_URL).
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function run() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage : node migrations/run-sql.js <fichier.sql>');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(file), 'utf8');
  try {
    await pool.query(sql);
    console.log('[run-sql] Migration appliquée :', file);
    process.exit(0);
  } catch (e) {
    console.error('[run-sql] ERREUR :', e.message);
    process.exit(1);
  }
}

run();
