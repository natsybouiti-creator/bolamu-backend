// ============================================================
// BOLAMU — Controller Partenaire (validation vouchers Zora)
// ============================================================
const { validateVoucher, getVouchersByPhone } = require('../services/zora-voucher.service');
const pool = require('../config/db');

/**
 * validateVoucherHandler — Partenaire valide un voucher Zora
 */
async function validateVoucherHandler(req, res) {
  try {
    const { voucher_code } = req.body;
    const partenaire_phone = req.user.phone;

    if (!voucher_code) {
      return res.status(400).json({ success: false, error: 'missing_voucher_code' });
    }

    const result = await validateVoucher(voucher_code, partenaire_phone);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('[PARTENAIRE CONTROLLER] Erreur validateVoucher:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}

/**
 * getValidationsHandler — Liste des validations du partenaire aujourd'hui
 */
async function getValidationsHandler(req, res) {
  try {
    const partenaire_phone = req.user.phone;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await pool.query(
      `SELECT zv.id, zv.voucher_code, zv.validated_at, zv.method, zv.amount_fcfa,
              v.status, v.issued_at, v.expires_at,
              r.title as reward_name
       FROM zora_voucher_validations zv
       JOIN zora_vouchers v ON zv.voucher_code = v.uuid
       JOIN zora_rewards r ON v.reward_id = r.id
       WHERE zv.partner_phone = $1
         AND zv.validated_at >= $2
       ORDER BY zv.validated_at DESC`,
      [partenaire_phone, today]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('[PARTENAIRE CONTROLLER] Erreur getValidations:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
}

module.exports = {
  validateVoucherHandler,
  getValidationsHandler
};
