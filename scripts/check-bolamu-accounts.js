// Vérifier les comptes bolamu_accounts existants
const pool = require('../src/config/db');

async function checkAccounts() {
  try {
    const result = await pool.query(`
      SELECT account_id, account_type, balance FROM bolamu_accounts LIMIT 5
    `);
    
    console.log('=== COMPTES BOLAMU EXISTANTS ===');
    if (result.rows.length === 0) {
      console.log('Aucun compte trouvé');
    } else {
      result.rows.forEach(row => {
        console.log(`${row.account_id} : ${row.account_type} (solde: ${row.balance})`);
      });
    }
    console.log('===================================');
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await pool.end();
  }
}

checkAccounts();
