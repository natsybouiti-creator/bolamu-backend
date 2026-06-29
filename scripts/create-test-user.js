const pool = require('../src/config/db');

pool.query(
  "UPDATE users SET is_active = false WHERE phone = '+242099999998'"
).then(r => {
  console.log('Lignes insérées:', r.rowCount);
  pool.end();
}).catch(e => {
  console.error('Erreur:', e.message);
  pool.end();
});
