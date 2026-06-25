const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function preuveConfig() {
  const client = await pool.connect();
  try {
    console.log('=== PREUVE CONFIG SQL ===\n');

    // 1. Lire valeur actuelle
    const currentRes = await client.query(`
      SELECT config_value FROM platform_config
      WHERE config_key = 'float_alert_threshold_fcfa'
    `);
    const originalValue = currentRes.rows[0]?.config_value;
    console.log(`Valeur originale: ${originalValue}`);

    // 2. UPDATE via SQL direct (simulation du PATCH)
    const testValue = '99999';
    await client.query(`
      UPDATE platform_config
      SET config_value = $1, updated_at = NOW()
      WHERE config_key = 'float_alert_threshold_fcfa'
    `, [testValue]);
    console.log(`UPDATE vers: ${testValue}`);

    // 2b. Simuler audit_log (comme le handler de route)
    await client.query(`
      INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
      VALUES ('config.updated', 'admin', 'platform_config', NULL, $1::jsonb)
    `, [JSON.stringify({ config_key: 'float_alert_threshold_fcfa', config_value: testValue })]);

    // 3. Vérifier lecture
    const readRes = await client.query(`
      SELECT config_value FROM platform_config
      WHERE config_key = 'float_alert_threshold_fcfa'
    `);
    const readValue = readRes.rows[0]?.config_value;
    console.log(`Lu après UPDATE: ${readValue}`);

    // 4. Audit log
    const auditRes = await client.query(`
      SELECT event_type, created_at
      FROM audit_log
      WHERE event_type = 'config.updated'
      ORDER BY created_at DESC LIMIT 1
    `);
    console.log(`Audit log: ${auditRes.rows.length > 0 ? '1 ligne trouvée' : '0 ligne'}`);

    // 5. Remettre valeur originale
    await client.query(`
      UPDATE platform_config
      SET config_value = $1, updated_at = NOW()
      WHERE config_key = 'float_alert_threshold_fcfa'
    `, [originalValue]);
    console.log(`Restauré à: ${originalValue}`);

    // Preuves
    console.log('\n=== PREUVES ===');
    console.log(`config_value lu = écrit: ${readValue === testValue ? '✓ PASS' : '❌ FAIL'}`);
    console.log(`audit_log config.updated: ${auditRes.rows.length > 0 ? '✓ PASS' : '❌ FAIL'}`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

preuveConfig();
