const express = require('express');
const router = express.Router();
const { verifyToken } = require('../../middleware/auth.middleware');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const MOMO_BASE_URL = process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
const SUBSCRIPTION_KEY = process.env.MOMO_SUBSCRIPTION_KEY;
const API_USER = process.env.MOMO_API_USER;
const API_KEY = process.env.MOMO_API_KEY;
const ENV = process.env.MOMO_ENV || 'sandbox';

// ─── HELPER : générer token OAuth2 ───────────────────────────────────────────
async function getMoMoToken() {
  const credentials = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
  const res = await fetch(`${MOMO_BASE_URL}/collection/token/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
      'X-Target-Environment': ENV
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token MoMo échoué: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

// ─── POST /request — déclencher un paiement MoMo ─────────────────────────────
router.post('/request', verifyToken, async (req, res) => {
  try {
    const { phone } = req.user;
    const { amount, plan, currency = 'EUR' } = req.body;

    if (!amount || !plan)
      return res.status(400).json({ success: false, message: 'Montant et plan requis' });

    const referenceId = uuidv4();
    const token = await getMoMoToken();

    // Numéro de téléphone sans + pour MoMo
    const momoPhone = phone.replace('+', '').replace(/\s/g, '');

    const payBody = {
      amount: String(amount),
      currency: ENV === 'sandbox' ? 'EUR' : 'XAF',
      externalId: referenceId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: momoPhone
      },
      payerMessage: `Abonnement Bolamu — Plan ${plan}`,
      payeeNote: `Bolamu ${plan} — ${phone}`
    };

    const momoRes = await fetch(`${MOMO_BASE_URL}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': ENV,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
        'X-Callback-Url': `https://bolamu-backend.onrender.com/api/v1/payments/momo/callback`
      },
      body: JSON.stringify(payBody)
    });

    if (momoRes.status !== 202) {
      const errText = await momoRes.text();
      return res.status(400).json({ success: false, message: `MoMo erreur: ${errText}` });
    }

    // Sauvegarder la transaction en attente
    await db.query(
      `INSERT INTO payments (phone, amount, currency, plan, reference_id, status, provider, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', 'momo', NOW())
       ON CONFLICT (reference_id) DO NOTHING`,
      [phone, amount, 'XAF', plan, referenceId]
    );

    await db.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id)
       VALUES ('payment_initiated', $1, 'payments', $2)`,
      [phone, referenceId]
    );

    res.json({
      success: true,
      message: 'Demande de paiement envoyée sur votre téléphone',
      reference_id: referenceId
    });

  } catch (e) {
    console.error('MoMo request error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── GET /status/:referenceId — vérifier le statut ───────────────────────────
router.get('/status/:referenceId', verifyToken, async (req, res) => {
  try {
    const { referenceId } = req.params;
    const token = await getMoMoToken();

    const momoRes = await fetch(`${MOMO_BASE_URL}/collection/v1_0/requesttopay/${referenceId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Target-Environment': ENV,
        'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
      }
    });

    const data = await momoRes.json();

    // Si paiement réussi → mettre à jour abonnement
    if (data.status === 'SUCCESSFUL') {
      await handlePaymentSuccess(req.user.phone, referenceId);
    } else if (data.status === 'FAILED') {
      await db.query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE reference_id = $1`,
        [referenceId]
      );
    }

    res.json({ success: true, status: data.status, data });

  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── POST /callback — webhook MTN ────────────────────────────────────────────
router.post('/callback', async (req, res) => {
  try {
    const body = req.body;
    console.log('📲 MoMo Callback reçu:', JSON.stringify(body));

    const referenceId = body.externalId || body.financialTransactionId;
    const status = body.status;

    if (!referenceId) return res.status(200).json({ received: true });

    // Récupérer le paiement
    const payRes = await db.query('SELECT * FROM payments WHERE reference_id = $1', [referenceId]);
    if (!payRes.rows.length) return res.status(200).json({ received: true });

    const payment = payRes.rows[0];

    if (status === 'SUCCESSFUL') {
      await handlePaymentSuccess(payment.phone, referenceId);
    } else if (status === 'FAILED') {
      await db.query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE reference_id = $1`,
        [referenceId]
      );
    }

    res.status(200).json({ received: true });
  } catch (e) {
    console.error('MoMo callback error:', e);
    res.status(200).json({ received: true });
  }
});

// ─── HELPER : traiter paiement réussi ────────────────────────────────────────
async function handlePaymentSuccess(phone, referenceId) {
  // Récupérer le paiement
  const payRes = await db.query('SELECT * FROM payments WHERE reference_id = $1', [referenceId]);
  if (!payRes.rows.length) return;
  const payment = payRes.rows[0];

  if (payment.status === 'successful') return; // déjà traité

  // Mettre à jour le statut du paiement
  await db.query(
    `UPDATE payments SET status = 'successful', updated_at = NOW() WHERE reference_id = $1`,
    [referenceId]
  );

  // Calculer les dates d'abonnement
  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);

  // Créer ou renouveler l'abonnement
  await db.query(
    `INSERT INTO subscriptions (phone, plan, status, amount_fcfa, started_at, expires_at, payment_reference)
     VALUES ($1, $2, 'active', $3, $4, $5, $6)
     ON CONFLICT (phone) DO UPDATE SET
       plan = EXCLUDED.plan,
       status = 'active',
       amount_fcfa = EXCLUDED.amount_fcfa,
       started_at = EXCLUDED.started_at,
       expires_at = EXCLUDED.expires_at,
       payment_reference = EXCLUDED.payment_reference,
       updated_at = NOW()`,
    [phone, payment.plan, payment.amount, startDate, endDate, referenceId]
  );

  // Marquer user comme actif
  await db.query(
    `UPDATE users SET is_active = TRUE, updated_at = NOW() WHERE phone = $1`,
    [phone]
  );

  // Log audit
  await db.query(
    `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id)
     VALUES ('payment_successful', $1, 'payments', $2)`,
    [phone, referenceId]
  );

  console.log(`✅ Paiement confirmé pour ${phone} — plan ${payment.plan}`);
}

// ─── GET /history — historique des paiements ─────────────────────────────────
router.get('/history', verifyToken, async (req, res) => {
  try {
    const { phone } = req.user;
    const { rows } = await db.query(
      `SELECT * FROM payments WHERE phone = $1 ORDER BY created_at DESC LIMIT 20`,
      [phone]
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── GET /admin/all — tous les paiements (admin) ──────────────────────────────
router.get('/admin/all', verifyToken, async (req, res) => {
  try {
    const adminCheck = await db.query(
      `SELECT * FROM users WHERE phone = $1 AND role = 'admin'`, [req.user.phone]
    );
    if (!adminCheck.rows.length)
      return res.status(403).json({ success: false, message: 'Accès refusé' });

    const { rows } = await db.query(
      `SELECT * FROM payments ORDER BY created_at DESC LIMIT 200`
    );
    const stats = await db.query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'successful') as successful,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        SUM(amount) FILTER (WHERE status = 'successful') as total_amount
       FROM payments`
    );
    res.json({ success: true, data: rows, stats: stats.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;