const { Pool } = require('pg');
const { calculerICP } = require('../src/services/smartflow.service');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function parcoursNominal() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('=== PARCOURS NOMINAL QA ===\n');

    // 1. Utiliser un contrat existant
    const contractResult = await client.query(
      `SELECT id FROM company_contracts LIMIT 1`
    );

    if (contractResult.rows.length === 0) {
      console.log('❌ FAIL: Aucun contrat existant');
      await client.query('ROLLBACK');
      return;
    }

    const contractId = contractResult.rows[0].id;
    console.log(`✓ Contrat existant (ID: ${contractId})`);

    const currentMonth = new Date().toISOString().slice(0, 7);

    // 2. Calculer ICP mois courant
    const result = await calculerICP(contractId, currentMonth);

    if (result.success) {
      console.log(`✓ ICP calculé: score_icp=${result.data.score_icp}, taux_activite=${result.data.taux_activite}`);
    } else {
      console.log(`❌ FAIL: calculerICP a échoué: ${result.message}`);
      await client.query('ROLLBACK');
      return;
    }

    // 3. Vérifier icp_scores créé
    const icpResult = await client.query(
      `SELECT score_icp, mois FROM icp_scores
       WHERE contract_id = $1 AND mois = $2
       ORDER BY generated_at DESC LIMIT 1`,
      [contractId, currentMonth]
    );

    if (icpResult.rows.length > 0 && icpResult.rows[0].mois === currentMonth) {
      console.log(`✓ icp_scores créé: mois=${icpResult.rows[0].mois}, score_icp=${icpResult.rows[0].score_icp}`);
    } else {
      console.log('❌ FAIL: icp_scores vide ou mois incorrect');
      await client.query('ROLLBACK');
      return;
    }

    // 4. Vérifier smartflow_reports créé
    const reportResult = await client.query(
      `SELECT id, mois FROM smartflow_reports
       WHERE contract_id = $1 AND mois = $2
       ORDER BY generated_at DESC LIMIT 1`,
      [contractId, currentMonth]
    );

    if (reportResult.rows.length > 0) {
      console.log(`✓ smartflow_reports créé: id=${reportResult.rows[0].id}, mois=${reportResult.rows[0].mois}`);
    } else {
      console.log('❌ FAIL: smartflow_reports vide');
      await client.query('ROLLBACK');
      return;
    }

    // 5. Vérifier report_data non vide
    const reportDataResult = await client.query(
      `SELECT report_data FROM smartflow_reports
       WHERE contract_id = $1 AND mois = $2`,
      [contractId, currentMonth]
    );

    if (reportDataResult.rows.length > 0 && reportDataResult.rows[0].report_data) {
      const reportData = reportDataResult.rows[0].report_data;
      console.log(`✓ report_data non vide: ${Object.keys(reportData).length} champs`);
    } else {
      console.log('❌ FAIL: report_data vide');
      await client.query('ROLLBACK');
      return;
    }

    await client.query('ROLLBACK');
    console.log('\n✓ PASS: Parcours nominal complet');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

parcoursNominal();
