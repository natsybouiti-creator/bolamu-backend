require('dotenv').config();
const pool = require('../src/config/db');

async function fixZoraBalance() {
  const phone = '+242069735418';
  
  try {
    console.log('=== ÉTAPE 0 — Vérifier structure zora_ledger ===');
    const structureResult = await pool.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'zora_ledger' ORDER BY ordinal_position"
    );
    console.log('Colonnes:', structureResult.rows.map(r => r.column_name).join(', '));
    
    console.log('\n=== ÉTAPE 1 — Voir le détail du ledger ===');
    const ledgerResult = await pool.query(
      'SELECT id, points, category, action_type, earned_at FROM zora_ledger WHERE phone = $1 ORDER BY earned_at DESC',
      [phone]
    );
    console.log(JSON.stringify(ledgerResult.rows, null, 2));
    
    console.log('\n=== ÉTAPE 2 — Corriger le solde ===');
    const updateResult = await pool.query(
      `UPDATE zora_points 
       SET balance = (
         SELECT COALESCE(SUM(points), 0) 
         FROM zora_ledger 
         WHERE phone = $1
       )
       WHERE phone = $1`,
      [phone]
    );
    console.log('Rows updated:', updateResult.rowCount);
    
    console.log('\n=== ÉTAPE 3 — Vérifier ===');
    const verifyResult = await pool.query(
      'SELECT phone, balance FROM zora_points WHERE phone = $1',
      [phone]
    );
    console.log(JSON.stringify(verifyResult.rows, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

fixZoraBalance();
