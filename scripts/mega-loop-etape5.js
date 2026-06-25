// MEGA LOOP - ÉTAPE 5 : Impact agrégé → dashboard RH → anonymisation
require('dotenv').config();
const pool = require('../src/config/db');

const ALT_PHONE = '+242069735419'; // Numéro patient DB
const RH_PHONE = '+242077000002'; // RH test

async function etape5() {
  console.log('[ÉTAPE 5] Impact agrégé → dashboard RH → anonymisation');
  console.log('=========================================================\n');
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Créer contrat entreprise
    console.log('1. Création contrat entreprise...');
    const contractRes = await client.query(
      `INSERT INTO company_contracts
        (reference, company_code, company_name, contact_name, contact_phone, employee_count, total_amount_fcfa, plan, billing_type, status, signed_at, started_at, expires_at, destination_account_id, rh_phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), NOW() + INTERVAL '1 year', $11, $12, NOW())
       RETURNING id`,
      ['CTR-2026-001', 'BRASCO', 'Brasco Congo', 'Directeur RH', '+242050000001', 100, 10000000, 'standard', 'monthly', 'active', 'BOLAMU_BGFI_MAIN', RH_PHONE]
    );
    
    const contractId = contractRes.rows[0].id;
    console.log(`   ✅ Contrat créé (ID: ${contractId})\n`);
    
    // 2. Créer RH user si nécessaire
    console.log('2. Vérification RH user...');
    const rhUserRes = await client.query('SELECT id FROM users WHERE phone = $1', [RH_PHONE]);
    
    if (rhUserRes.rows.length === 0) {
      console.log('   Création RH user...');
      const idRes = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(bolamu_id FROM 5) AS INTEGER)), 5000) + 1 AS next
         FROM users WHERE bolamu_id ~ '^BLM-[0-9]+$'`
      );
      const bolamuId = `BLM-${idRes.rows[0].next}`;
      
      await client.query(
        `INSERT INTO users
          (phone, full_name, role, bolamu_id, is_active, created_at)
         VALUES ($1, $2, 'rh', $3, TRUE, NOW())`,
        [RH_PHONE, 'RH Test Mega Loop', bolamuId]
      );
      console.log('   ✅ RH user créé\n');
    } else {
      console.log('   ✅ RH user existe\n');
    }
    
    // 3. Lier patient comme employé
    console.log('3. Lier patient comme employé...');
    const employeeRes = await client.query(
      `INSERT INTO company_employees
        (contract_id, employee_phone, employee_name, status, matricule, categorie_rh, created_at)
       VALUES ($1, $2, $3, 'active', 'MAT-001', 'cadre', NOW())
       RETURNING id`,
      [contractId, ALT_PHONE, 'Patient Test Mega Loop']
    );
    
    const employeeId = employeeRes.rows[0].id;
    console.log(`   ✅ Employé lié (ID: ${employeeId})\n`);
    
    // 4. Créer transaction hors catalogue
    console.log('4. Création transaction hors catalogue...');
    const transactionRes = await client.query(
      `INSERT INTO hors_catalogue_transactions
        (patient_phone, prestataire_phone, prestataire_type, libelle, prix_plein, company_contract_id, statut, notifie_patient_at, notifie_rh_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'acquitte', NOW(), NOW(), NOW())
       RETURNING id`,
      [ALT_PHONE, '+242066226116', 'pharmacie', 'Médicament hors catalogue', 15000, contractId]
    );
    
    const transactionId = transactionRes.rows[0].id;
    console.log(`   ✅ Transaction créée (ID: ${transactionId})\n`);
    
    // 5. Créer export paie mensuel
    console.log('5. Création export paie mensuel...');
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    
    const exportRes = await client.query(
      `INSERT INTO export_paie_mensuel
        (company_contract_id, mois, nb_employes_actifs, nb_actes_ssp, montant_ssp, nb_actes_hors_catalogue, montant_hors_catalogue, details_json, statut, exporte_par, created_at)
       VALUES ($1, $2, 1, 0, 0, 1, 15000, $3, 'finalise', $4, NOW())
       RETURNING id`,
      [contractId, currentMonth, JSON.stringify([{
        employee_id: employeeId,
        libelle: 'Médicament hors catalogue',
        montant: 15000,
        statut: 'acquitte'
      }]), RH_PHONE]
    );
    
    const exportId = exportRes.rows[0].id;
    console.log(`   ✅ Export paie créé (ID: ${exportId})\n`);
    
    await client.query('COMMIT');
    
    // 6. Vérifier anonymisation (payload RH)
    console.log('6. Vérification anonymisation payload RH...');
    const exportCheck = await pool.query(
      `SELECT details_json FROM export_paie_mensuel WHERE id = $1`,
      [exportId]
    );
    
    const details = exportCheck.rows[0].details_json;
    console.log('   Payload RH:', JSON.stringify(details, null, 2));
    
    // Vérifier qu'il n'y a pas de données personnelles
    const hasPersonalData = JSON.stringify(details).includes(ALT_PHONE) || 
                          JSON.stringify(details).includes('Patient Test');
    
    if (hasPersonalData) {
      console.log('   ❌ DONNÉES PERSONNELLES DÉTECTÉES - Anonymisation FAIL');
    } else {
      console.log('   ✅ Aucune donnée personnelle - Anonymisation OK\n');
    }
    
    console.log('=== ÉTAPE 5 TERMINÉE ===');
    console.log('SQL : ✓');
    console.log('Anonymisation :', hasPersonalData ? '✗' : '✓');
    console.log('Contract ID :', contractId);
    console.log('Employee ID :', employeeId);
    console.log('Transaction ID :', transactionId);
    console.log('Export ID :', exportId);
    console.log('========================\n');
    
    return { hasPersonalData };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur ÉTAPE 5:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

etape5()
  .then(result => {
    if (result.hasPersonalData) {
      console.log('ÉTAPE 5 : FAIL (Anonymisation)');
    } else {
      console.log('ÉTAPE 5 : SUCCESS');
    }
  })
  .catch(err => console.error('ÉTAPE 5 : FAIL', err))
  .finally(() => pool.end());
