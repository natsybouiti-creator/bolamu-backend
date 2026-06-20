// ============================================================
// BOLAMU — Sprint 3 : Routes Marketplace Zora
// ============================================================
const express = require('express');
const router = express.Router();
const {
  redeemReward,
  consumeVoucher,
  getRewards,
  getUserVouchers,
  getVoucherByUuid,
  getPartnerVouchers
} = require('../services/zora-marketplace.service');
const authMiddleware = require('../middleware/auth.middleware');

// ============================================================
// CÔTÉ PATIENT
// ============================================================

// GET /api/v1/zora/rewards - Liste des récompenses disponibles (PUBLIC)
router.get('/rewards', async (req, res) => {
  try {
    const { category } = req.query;
    
    const result = await getRewards({ category });
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur GET /rewards:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// POST /api/v1/zora/redeem - Échanger des points contre une récompense
router.post('/redeem', authMiddleware, async (req, res) => {
  try {
    const { reward_id } = req.body;
    const phone = req.user.phone;
    
    if (!reward_id) {
      return res.status(400).json({ success: false, error: 'missing_reward_id' });
    }
    
    const result = await redeemReward({ phone, reward_id });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'reward_not_found': 404,
        'tier_insufficient': 403,
        'insufficient_balance': 400,
        'reward_exhausted': 400,
        'user_not_found': 404
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur POST /redeem:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/zora/vouchers - Liste des vouchers du patient
router.get('/vouchers', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    
    const result = await getUserVouchers(phone);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur GET /vouchers:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/zora/vouchers/:uuid - Détail d'un voucher
router.get('/vouchers/:uuid', authMiddleware, async (req, res) => {
  try {
    const { uuid } = req.params;
    
    const result = await getVoucherByUuid(uuid);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      const statusCode = result.error === 'voucher_not_found' ? 404 : 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur GET /vouchers/:uuid:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// ============================================================
// CÔTÉ PARTENAIRE
// ============================================================

// POST /api/v1/zora/vouchers/:uuid/consume - Consommer un voucher
router.post('/vouchers/:uuid/consume', authMiddleware, async (req, res) => {
  try {
    const { uuid } = req.params;
    const partner_phone = req.user.phone;
    
    // Vérifier que l'utilisateur est un partenaire
    if (!['pharmacy', 'doctor', 'laboratory'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'not_authorized' });
    }
    
    const result = await consumeVoucher({ voucher_uuid: uuid, partner_phone });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      const statusMap = {
        'voucher_not_found': 404,
        'voucher_already_used': 400,
        'voucher_expired': 400,
        'partner_not_authorized': 403
      };
      const statusCode = statusMap[result.error] || 500;
      res.status(statusCode).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur POST /vouchers/:uuid/consume:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

// GET /api/v1/zora/partner/vouchers - Historique des vouchers consommés par le partenaire
router.get('/partner/vouchers', authMiddleware, async (req, res) => {
  try {
    const partner_phone = req.user.phone;
    
    // Vérifier que l'utilisateur est un partenaire
    if (!['pharmacy', 'doctor', 'laboratory'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'not_authorized' });
    }
    
    const result = await getPartnerVouchers(partner_phone);
    
    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[ZORA MARKETPLACE] Erreur GET /partner/vouchers:', error.message);
    res.status(500).json({ success: false, error: 'server_error' });
  }
});

module.exports = router;
