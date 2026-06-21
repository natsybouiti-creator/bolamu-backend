const db = require('../config/db');

const bhpPurgeJob = async () => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      WITH candidats AS (
        SELECT id FROM health_records
        WHERE is_deleted = true
        AND updated_at < NOW() - INTERVAL '5 years'
      ),
      logs_supprimes AS (
        DELETE FROM health_record_access_log
        WHERE record_id IN (SELECT id FROM candidats)
        RETURNING record_id
      )
      DELETE FROM health_records
      WHERE id IN (SELECT id FROM candidats)
      RETURNING id
    `);

    await client.query('COMMIT');

    await db.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('BHP_PURGE_PHYSIQUE', 'system', 'health_records', NULL, $1::jsonb)`,
      [JSON.stringify({ count: result.rowCount, date: new Date() })]
    );

    console.log(`[BHP Purge] ${result.rowCount} enregistrement(s) purgé(s).`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BHP Purge] Échec:', err.message);
  } finally {
    client.release();
  }
};

module.exports = { bhpPurgeJob };
