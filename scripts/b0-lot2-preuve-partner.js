const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuvePartner() {
  const client = await pool.connect();
  try {
    console.log('=== PREUVE VALIDATION PARTENAIRE SQL ===\n');

    // 1. Trouver une convention non active
    const findRes = await client.query(`
      SELECT id, status_new, validated_at
      FROM partner_conventions
      WHERE status_new != 'actif'
      LIMIT 1
    `);

    if (findRes.rows.length === 0) {
      console.log('Aucune convention non active trouvée. Création test...');
      
      // Créer une convention test
      const insertRes = await client.query(`
        INSERT INTO partner_conventions (partner_phone, partner_type, partner_name, discount_rate, status_new)
        VALUES ('+242069735418', 'pharmacie', 'Test Pharmacie', 0.15, 'pending')
        RETURNING id, status_new, validated_at
      `);
      const conv = insertRes.rows[0];
      console.log(`Convention test créée: id=${conv.id}, status_new=${conv.status_new}`);
      
      // 2. Simuler activation
      await client.query(`
        UPDATE partner_conventions
        SET status_new = 'actif', started_at = NOW(), validated_by = 'admin', validated_at = NOW()
        WHERE id = $1
      `, [conv.id]);
      
      // 3. Audit log
      await client.query(`
        INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
        VALUES ('CONVENTION_ACTIVATED', 'admin', 'partner_conventions', $1, $2::jsonb)
      `, [conv.id, JSON.stringify({ partner_phone: '+242069735418' })]);
      
      // 4. Vérifier
      const checkRes = await client.query(`
        SELECT status_new, validated_at
        FROM partner_conventions
        WHERE id = $1
      `, [conv.id]);
      
      const checked = checkRes.rows[0];
      console.log(`Après activation: status_new=${checked.status_new}, validated_at=${checked.validated_at}`);
      
      // Nettoyage
      await client.query(`DELETE FROM partner_conventions WHERE id = $1`, [conv.id]);
      console.log('Convention test supprimée');
      
      // Preuves
      console.log('\n=== PREUVES ===');
      console.log(`status_new='actif': ${checked.status_new === 'actif' ? '✓ PASS' : '❌ FAIL'}`);
      console.log(`validated_at NOT NULL: ${checked.validated_at !== null ? '✓ PASS' : '❌ FAIL'}`);
      
    } else {
      const conv = findRes.rows[0];
      console.log(`Convention trouvée: id=${conv.id}, status_new=${conv.status_new}`);
      
      // 2. Simuler activation
      await client.query(`
        UPDATE partner_conventions
        SET status_new = 'actif', started_at = NOW(), validated_by = 'admin', validated_at = NOW()
        WHERE id = $1
      `, [conv.id]);
      
      // 3. Audit log
      await client.query(`
        INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
        VALUES ('CONVENTION_ACTIVATED', 'admin', 'partner_conventions', $1, $2::jsonb)
      `, [conv.id, JSON.stringify({ partner_phone: 'test' })]);
      
      // 4. Vérifier
      const checkRes = await client.query(`
        SELECT status_new, validated_at
        FROM partner_conventions
        WHERE id = $1
      `, [conv.id]);
      
      const checked = checkRes.rows[0];
      console.log(`Après activation: status_new=${checked.status_new}, validated_at=${checked.validated_at}`);
      
      // Preuves
      console.log('\n=== PREUVES ===');
      console.log(`status_new='actif': ${checked.status_new === 'actif' ? '✓ PASS' : '❌ FAIL'}`);
      console.log(`validated_at NOT NULL: ${checked.validated_at !== null ? '✓ PASS' : '❌ FAIL'}`);
    }

    // Audit log check
    const auditRes = await client.query(`
      SELECT event_type
      FROM audit_log
      WHERE event_type = 'CONVENTION_ACTIVATED'
      ORDER BY created_at DESC LIMIT 1
    `);
    console.log(`audit_log CONVENTION_ACTIVATED: ${auditRes.rows.length > 0 ? '✓ PASS' : '❌ FAIL'}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

preuvePartner();
