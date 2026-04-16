const pool = require('../config/db');
const crypto = require('crypto');

const generateQRToken = async (req, res) => {
  const { phone } = req.user;
  try {
    const subCheck = await pool.query(
      `SELECT id FROM subscriptions WHERE patient_phone = $1 AND status = 'active' AND expires_at >= NOW() LIMIT 1`,
      [phone]
    );
    if (subCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Aucun abonnement actif. Veuillez renouveler votre abonnement.' });
    }
    const configRes = await pool.query(
      `SELECT config_value FROM platform_config WHERE config_key = 'qr_token_ttl_seconds'`
    );
    const ttlSeconds = parseInt(configRes.rows[0]?.config_value || '60');
    await pool.query(
      `UPDATE qr_tokens SET used_at = NOW() WHERE user_phone = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [phone]
    );
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await pool.query(
      `INSERT INTO qr_tokens (user_phone, token, expires_at) VALUES ($1, $2, $3)`,
      [phone, token, expiresAt]
    );
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('QR_GENERATED', $1, 'qr_tokens', NULL, $2)`,
      [phone, JSON.stringify({ expires_at: expiresAt })]
    );
    return res.status(200).json({ success: true, data: { token, expires_at: expiresAt, ttl_seconds: ttlSeconds, phone } });
  } catch (error) {
    console.error('generateQRToken error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

const verifyQRToken = async (req, res) => {
  const { token } = req.body;
  const partnerPhone = req.user.phone;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token manquant.' });
  }
  try {
    const tokenRes = await pool.query(
      `SELECT qt.*, u.full_name, u.phone as patient_phone FROM qr_tokens qt JOIN users u ON u.phone = qt.user_phone WHERE qt.token = $1`,
      [token]
    );
    if (tokenRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'QR Code invalide.' });
    }
    const qrToken = tokenRes.rows[0];
    if (new Date() > new Date(qrToken.expires_at)) {
      return res.status(410).json({ success: false, message: 'QR Code expiré. Demandez au patient d\'en générer un nouveau.' });
    }
    if (qrToken.used_at) {
      return res.status(409).json({ success: false, message: 'QR Code déjà utilisé.' });
    }
    const subCheck = await pool.query(
      `SELECT s.id, s.plan, s.expires_at, pc.config_value as monthly_cap FROM subscriptions s LEFT JOIN platform_config pc ON pc.config_key = 'tiers_payant_monthly_cap' WHERE s.patient_phone = $1 AND s.status = 'active' AND s.expires_at >= NOW() LIMIT 1`,
      [qrToken.user_phone]
    );
    if (subCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Abonnement patient inactif ou expiré.' });
    }
    const convRes = await pool.query(
      `SELECT discount_rate, monthly_cap_fcfa, partner_name FROM partner_conventions WHERE partner_phone = $1 AND status = 'actif'`,
      [partnerPhone]
    );
    if (convRes.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Votre établissement n\'a pas de convention active avec Bolamu.' });
    }
    const convention = convRes.rows[0];
    const consumptionRes = await pool.query(
      `SELECT COALESCE(SUM(bolamu_share_fcfa), 0) as total_consumed FROM transactions_tiers_payant WHERE patient_phone = $1 AND status IN ('validated', 'paid') AND created_at >= date_trunc('month', NOW())`,
      [qrToken.user_phone]
    );
    const totalConsumed = parseInt(consumptionRes.rows[0].total_consumed);
    const sub = subCheck.rows[0];
    await pool.query(`UPDATE qr_tokens SET used_by = $1 WHERE token = $2`, [partnerPhone, token]);
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('QR_SCANNED', $1, 'qr_tokens', NULL, $2)`,
      [partnerPhone, JSON.stringify({ patient_phone: qrToken.user_phone, token })]
    );
    return res.status(200).json({
      success: true,
      data: {
        patient: { phone: qrToken.user_phone, full_name: qrToken.full_name, plan: sub.plan, subscription_end: sub.expires_at },
        convention: { discount_rate: parseFloat(convention.discount_rate), partner_name: convention.partner_name },
        consumption: { this_month_fcfa: totalConsumed, monthly_cap_fcfa: convention.monthly_cap_fcfa },
        token_expires_at: qrToken.expires_at
      }
    });
  } catch (error) {
    console.error('verifyQRToken error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

module.exports = { generateQRToken, verifyQRToken };