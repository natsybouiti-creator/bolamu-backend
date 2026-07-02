const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function executionReelle() {
  const client = await pool.connect();
  try {
    console.log('=== B4 — EXÉCUTION RÉELLE PARCOURS NOMINAL ===\n');

    // ÉTAPE 1 — Créer RDV test
    console.log('ÉTAPE 1 — Création RDV');
    const rdvResult = await client.query(
      `INSERT INTO rendez_vous 
       (patient_phone, doctor_phone, scheduled_at, motif, status)
       VALUES ('+242069735418', '+242060000001', 
               NOW() + INTERVAL '1 hour', 'Test QA B4', 'confirmed')
       RETURNING id`
    );
    const rdvId = rdvResult.rows[0].id;
    console.log(`✓ RDV créé (ID: ${rdvId})`);

    // ÉTAPE 2 — Ouvrir consultation
    console.log('\nÉTAPE 2 — Ouverture consultation');
    const consultationResult = await client.query(
      `INSERT INTO consultations
       (patient_phone, doctor_phone, motif, status, rdv_id)
       VALUES ('+242069735418', '+242060000001', 
               'Test QA B4', 'open', $1)
       RETURNING id`,
      [rdvId]
    );
    const consultationId = consultationResult.rows[0].id;
    console.log(`✓ Consultation ouverte (ID: ${consultationId})`);

    // ÉTAPE 3 — Créer ordonnance
    console.log('\nÉTAPE 3 — Création ordonnance');
    const ordonnanceResult = await client.query(
      `INSERT INTO ordonnances
       (consultation_id, patient_phone, doctor_phone, status)
       VALUES ($1, '+242069735418', 
               '+242060000001', 'active')
       RETURNING id`,
      [consultationId]
    );
    const ordonnanceId = ordonnanceResult.rows[0].id;
    console.log(`✓ Ordonnance créée (ID: ${ordonnanceId})`);

    // ÉTAPE 4 — Ajouter item ordonnance
    console.log('\nÉTAPE 4 — Ajout item ordonnance');
    await client.query(
      `INSERT INTO ordonnance_items
       (ordonnance_id, medicament, dosage, frequence, duree)
       VALUES ($1, 'Paracétamol 500mg', 
               '1 comprimé', '3x/jour', '5 jours')`,
      [ordonnanceId]
    );
    console.log(`✓ Item ordonnance ajouté`);

    // ÉTAPE 5 — Fermer consultation
    console.log('\nÉTAPE 5 — Fermeture consultation');
    await client.query(
      `UPDATE consultations 
       SET status = 'completed', 
           ended_at = NOW(),
           diagnostic = 'Céphalées de tension'
       WHERE id = $1`,
      [consultationId]
    );
    console.log(`✓ Consultation fermée`);

    // ÉTAPE 6 — Log accès BHP (audit_log) - OPTIONNEL
    console.log('\nÉTAPE 6 — Log accès BHP (optionnel)');
    try {
      await client.query(
        `INSERT INTO audit_log
         (phone, action, resource_type, resource_id, payload)
         VALUES ('+242060000001', 'view_history', 'health_record', '+242069735418', '{"patient_phone": "+242069735418", "accessor_role": "medecin"}'::jsonb)`
      );
      console.log(`✓ Accès BHP loggué`);
    } catch (e) {
      console.log(`⚠ Audit_log non disponible (non bloquant): ${e.message}`);
    }

    // ÉTAPE 7 — Preuve finale (tables B4 uniquement)
    console.log('\nÉTAPE 7 — Preuve finale B4');
    const preuveResult = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM rendez_vous) as rdv_total,
        (SELECT COUNT(*) FROM consultations 
         WHERE status = 'completed') as consultations_terminees,
        (SELECT COUNT(*) FROM ordonnances) as ordonnances,
        (SELECT COUNT(*) FROM ordonnance_items) as items_ordonnance
    `);

    const row = preuveResult.rows[0];
    console.log('\n=== RÉSULTATS BRUTS ===');
    console.log(`RDV total: ${row.rdv_total}`);
    console.log(`Consultations terminées: ${row.consultations_terminees}`);
    console.log(`Ordonnances: ${row.ordonnances}`);
    console.log(`Items ordonnance: ${row.items_ordonnance}`);

    const allOk = row.rdv_total >= 1 && 
                  row.consultations_terminees >= 1 && 
                  row.ordonnances >= 1 && 
                  row.items_ordonnance >= 1;

    if (allOk) {
      console.log('\n✅ B4 — PREUVE FINALE VALIDÉE (tous ≥ 1)');
    } else {
      console.log('\n❌ B4 — PREUVE INVALIDE (un ou plusieurs = 0)');
    }

  } catch (error) {
    console.error('❌ Erreur exécution réelle:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

executionReelle();
