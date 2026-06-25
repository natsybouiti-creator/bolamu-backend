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

async function validerClearing(partner_phone, periode) {
  const normalizedPhone = normalizePhone(partner_phone);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateResult = await client.query(
      `UPDATE clearing_transactions 
       SET status = 'cleared', cleared_at = NOW()
       WHERE partner_phone = $1
       AND status = 'pending'
       AND created_at BETWEEN $2 AND $3
       RETURNING SUM(amount_fcfa)`,
      [normalizedPhone, periode.debut, periode.fin]
    );

    const total_fcfa = parseFloat(updateResult.rows[0].sum) || 0;
    const cleared_count = updateResult.rowCount || 0;

    if (cleared_count > 0) {
      await client.query(
        `INSERT INTO partner_payouts (partner_phone, partner_type, period_start, period_end, member_count, amount_fcfa, status)
         VALUES ($1, 'partenaire', $2, $3, 1, $4, 'pending')
         RETURNING id`,
        [normalizedPhone, periode.debut, periode.fin, total_fcfa]
      );
    }

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
