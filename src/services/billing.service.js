const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');

async function calculerReversement(partner_phone, partner_type, periode) {
  const normalizedPhone = normalizePhone(partner_phone);
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT reference_id, reference_type, amount_fcfa, created_at
       FROM clearing_transactions
       WHERE partner_phone = $1
       AND partner_type = $2
       AND created_at BETWEEN $3 AND $4
       AND status = 'pending'
       ORDER BY created_at ASC`,
      [normalizedPhone, partner_type, periode.debut, periode.fin]
    );

    const total_fcfa = result.rows.reduce((sum, row) => sum + parseFloat(row.amount_fcfa), 0);
    const detail = result.rows.map(row => ({
      reference_id: row.reference_id,
      reference_type: row.reference_type,
      amount_fcfa: parseFloat(row.amount_fcfa),
      created_at: row.created_at
    }));

    return { total_fcfa, nb_transactions: result.rows.length, detail };
  } finally {
    client.release();
  }
}

async function validerClearing(partner_phone, partner_type, periode) {
  const normalizedPhone = normalizePhone(partner_phone);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Total calculé AVANT l'UPDATE : RETURNING ne supporte pas les fonctions
    // d'agrégat sur un UPDATE multi-lignes en PostgreSQL (bug corrigé).
    const totalResult = await client.query(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_fcfa), 0) AS total
       FROM clearing_transactions
       WHERE partner_phone = $1 AND partner_type = $2 AND status = 'pending'
       AND created_at BETWEEN $3 AND $4`,
      [normalizedPhone, partner_type, periode.debut, periode.fin]
    );
    const cleared_count = parseInt(totalResult.rows[0].cnt, 10);
    const total_fcfa = parseFloat(totalResult.rows[0].total) || 0;

    if (cleared_count === 0) {
      await client.query('COMMIT');
      return { cleared_count: 0, total_fcfa: 0 };
    }

    await client.query(
      `UPDATE clearing_transactions
       SET status = 'cleared', cleared_at = NOW()
       WHERE partner_phone = $1 AND partner_type = $2 AND status = 'pending'
       AND created_at BETWEEN $3 AND $4`,
      [normalizedPhone, partner_type, periode.debut, periode.fin]
    );

    // partner_type réel du partenaire (avant : toujours 'partenaire' en dur,
    // corrompait le type réel pharmacie/laboratoire du versement créé)
    await client.query(
      `INSERT INTO partner_payouts (partner_phone, partner_type, period_start, period_end, member_count, amount_fcfa, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [normalizedPhone, partner_type, periode.debut, periode.fin, cleared_count, total_fcfa]
    );

    await client.query('COMMIT');
    return { cleared_count, total_fcfa };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { calculerReversement, validerClearing };
