const { Pool } = require('pg');
const { calculerICP } = require('../src/services/smartflow.service');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuveLot2() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('=== PREUVE LOT 2 ===\n');

    // Utiliser un contrat existant
    const contractResult = await client.query(
      `SELECT id FROM company_contracts LIMIT 1`
    );

    if (contractResult.rows.length === 0) {
      console.log('❌ FAIL: Aucun contrat existant');
      await client.query('ROLLBACK');
      return;
    }

    const contractId = contractResult.rows[0].id;
    console.log(`✓ Contrat existant utilisé (ID: ${contractId})`);

    // Créer des users pour les employés de test
    await client.query(
      `INSERT INTO users (phone, password_hash, role, is_active, first_name, full_name)
       VALUES ('+242077000010', '$2b$10$test', 'patient', TRUE, 'Employé', 'Employé Test 1'),
              ('+242077000011', '$2b$10$test', 'patient', TRUE, 'Employé', 'Employé Test 2')
       ON CONFLICT (phone) DO UPDATE SET first_name = EXCLUDED.first_name, full_name = EXCLUDED.full_name`,
      []
    );
    console.log('✓ 2 users créés');

    // Créer des employés de test (sans ON CONFLICT pour éviter l'erreur)
    const existingEmployees = await client.query(
      `SELECT employee_phone FROM company_employees WHERE contract_id = $1`,
      [contractId]
    );
    const existingPhones = new Set(existingEmployees.rows.map(r => r.employee_phone));

    if (!existingPhones.has('+242077000010')) {
      await client.query(
        `INSERT INTO company_employees (contract_id, employee_phone, employee_name, status, matricule, categorie_rh)
         VALUES ($1, '+242077000010', 'Employé Test 1', 'active', 'EMP001', 'employe')`,
        [contractId]
      );
    }
    if (!existingPhones.has('+242077000011')) {
      await client.query(
        `INSERT INTO company_employees (contract_id, employee_phone, employee_name, status, matricule, categorie_rh)
         VALUES ($1, '+242077000011', 'Employé Test 2', 'active', 'EMP002', 'cadre')`,
        [contractId]
      );
    }
    console.log('✓ 2 employés créés');

    // Créer des wellness_actions de test
    await client.query(
      `INSERT INTO wellness_actions (patient_phone, action_type, zora_points, validated_by, validated_at, reference_id)
       VALUES ('+242077000010', 'profil_complete', 50, 'system', NOW(), 'ref1'),
              ('+242077000011', 'profil_complete', 50, 'system', NOW(), 'ref2')`,
      []
    );
    console.log('✓ 2 wellness_actions créées');

    const currentMonth = new Date().toISOString().slice(0, 7);

    // Calculer ICP
    const result = await calculerICP(contractId, currentMonth);

    if (result.success) {
      console.log(`✓ ICP calculé: score_icp=${result.data.score_icp}, taux_activite=${result.data.taux_activite}`);
    } else {
      console.log(`❌ FAIL: calculerICP a échoué: ${result.message}`);
      await client.query('ROLLBACK');
      return;
    }

    // Vérifier icp_scores
    const icpResult = await client.query(
      `SELECT score_icp, taux_activite, nb_employes FROM icp_scores
       WHERE contract_id = $1 AND mois = $2`,
      [contractId, currentMonth]
    );

    if (icpResult.rows.length > 0) {
      console.log(`✓ icp_scores créé: score_icp=${icpResult.rows[0].score_icp}, nb_employes=${icpResult.rows[0].nb_employes}`);
    } else {
      console.log('❌ FAIL: icp_scores vide');
      await client.query('ROLLBACK');
      return;
    }

    // Vérifier smartflow_reports
    const reportResult = await client.query(
      `SELECT id, mois FROM smartflow_reports
       WHERE contract_id = $1 AND mois = $2`,
      [contractId, currentMonth]
    );

    if (reportResult.rows.length > 0) {
      console.log(`✓ smartflow_reports créé: id=${reportResult.rows[0].id}, mois=${reportResult.rows[0].mois}`);
    } else {
      console.log('❌ FAIL: smartflow_reports vide');
      await client.query('ROLLBACK');
      return;
    }

    await client.query('ROLLBACK'); // Cleanup test data
    console.log('\n✓ PASS: ICP calculé et tables peuplées');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

preuveLot2();
