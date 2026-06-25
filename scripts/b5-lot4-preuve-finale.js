const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuveFinale() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT
        (SELECT COUNT(*) FROM ordonnances WHERE status = 'dispensed') as ordonnances_dispensees,
        (SELECT COUNT(*) FROM lab_results) as resultats_labo,
        (SELECT COUNT(*) FROM clearing_transactions WHERE status = 'pending') as clearing_en_attente,
        (SELECT COUNT(*) FROM partner_payouts) as payouts`
    );
    
    const proof = result.rows[0];
    console.log('=== PREUVE FINALE BOUCLE 5 ===\n');
    console.log(`Ordonnances dispensées: ${proof.ordonnances_dispensees}`);
    console.log(`Résultats labo: ${proof.resultats_labo}`);
    console.log(`Clearing en attente: ${proof.clearing_en_attente}`);
    console.log(`Payouts: ${proof.payouts}`);
    
    const allOk = proof.ordonnances_dispensees >= 1 && proof.resultats_labo >= 1 && proof.clearing_en_attente >= 1;
    console.log(`\n${allOk ? '✓ PREUVE FINALE VALIDÉE' : '❌ PREUVE FINALE ÉCHOUÉE'}`);
    
    if (!allOk) {
      console.log('\nConditions requises:');
      console.log('- ordonnances_dispensees ≥ 1');
      console.log('- resultats_labo ≥ 1');
      console.log('- clearing_en_attente ≥ 1');
    }
    
  } catch (error) {
    console.error('❌ Erreur preuve finale:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

preuveFinale();
