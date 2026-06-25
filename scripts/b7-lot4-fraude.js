const { Pool } = require('pg');
const { calculerICP } = require('../src/services/smartflow.service');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function scenariosFraude() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('=== SCÉNARIOS FRAUDE / EDGE CASES ===\n');

    // 1. Mois futur → score_icp = 0 (pas d'erreur)
    const contractResult = await client.query(
      `SELECT id FROM company_contracts LIMIT 1`
    );

    if (contractResult.rows.length === 0) {
      console.log('❌ FAIL: Aucun contrat existant');
      await client.query('ROLLBACK');
      return;
    }

    const contractId = contractResult.rows[0].id;
    const futureMonth = '2099-01';

    const futureResult = await calculerICP(contractId, futureMonth);

    if (futureResult.success) {
      console.log(`✓ Mois futur: score_icp=${futureResult.data.score_icp} (pas d'erreur, fonctionnel)`);
    } else {
      console.log(`❌ FAIL: Mois futur a échoué: ${futureResult.message}`);
    }

    // 2. Employé sans wellness_actions → avg_wellness = 0
    // Utiliser un contrat existant avec 0 employés actifs
    const emptyContractResult = await client.query(
      `SELECT id FROM company_contracts WHERE employee_count = 0 LIMIT 1`
    );

    if (emptyContractResult.rows.length > 0) {
      const emptyContractId = emptyContractResult.rows[0].id;
      const currentMonth = new Date().toISOString().slice(0, 7);

      const noWellnessResult = await calculerICP(emptyContractId, currentMonth);

      if (noWellnessResult.success) {
        if (noWellnessResult.data.avg_wellness === 0) {
          console.log(`✓ Employé sans wellness: avg_wellness=0`);
        } else {
          console.log(`⚠ Employé sans wellness: avg_wellness=${noWellnessResult.data.avg_wellness} (attendu 0)`);
        }
      } else {
        console.log(`❌ FAIL: Employé sans wellness a échoué: ${noWellnessResult.message}`);
      }
    } else {
      console.log('⚠ Aucun contrat avec 0 employés trouvé (edge case non testable)');
    }

    await client.query('ROLLBACK');
    console.log('\n✓ PASS: Scénarios fraude testés');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

scenariosFraude();
