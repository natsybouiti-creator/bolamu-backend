// ============================================================
// BOLAMU — Sprint 2 : Routes Zora Points
// ============================================================
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { 
  awardZora, 
  getZoraBalance, 
  getZoraLedger, 
  getZoraTiers, 
  getZoraEarnRules 
} = require('../services/zora.service');

// Middleware pour vérifier le rôle admin
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
  }
  next();
}

// ─── GET /api/v1/zora/balance ─────────────────────────────────────
// Récupérer le solde Zora d'un utilisateur
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const balance = await getZoraBalance(phone);
    res.json({ success: true, data: balance });
  } catch (error) {
    console.error('[zora/balance]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── GET /api/v1/zora/ledger ─────────────────────────────────────
// Récupérer le ledger Zora d'un utilisateur (paginé)
router.get('/ledger', authMiddleware, async (req, res) => {
  try {
    const phone = req.user.phone;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const ledger = await getZoraLedger(phone, page, limit);
    res.json({ success: true, data: ledger });
  } catch (error) {
    console.error('[zora/ledger]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── GET /api/v1/zora/tiers ───────────────────────────────────────
// Récupérer la configuration des paliers
router.get('/tiers', async (req, res) => {
  try {
    const tiers = await getZoraTiers();
    res.json({ success: true, data: tiers });
  } catch (error) {
    console.error('[zora/tiers]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── GET /api/v1/zora/earn-rules ───────────────────────────────────
// Récupérer les règles de gain actives
router.get('/earn-rules', async (req, res) => {
  try {
    const rules = await getZoraEarnRules();
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('[zora/earn-rules]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── POST /api/v1/zora/earn ────────────────────────────────────────
// Créditer manuellement des points Zora (admin uniquement)
router.post('/earn', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { phone, action_type, proof_class, proof_source, recording_method, proof_reference } = req.body;
    
    if (!phone || !action_type || !proof_class || !proof_reference) {
      return res.status(400).json({ 
        success: false, 
        message: 'phone, action_type, proof_class et proof_reference requis' 
      });
    }
    
    const result = await awardZora({
      phone,
      action_type,
      proof_class,
      proof_source,
      recording_method,
      proof_reference
    });
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.json({ success: false, reason: result.reason });
    }
  } catch (error) {
    console.error('[zora/earn]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ─── POST /api/v1/zora/reset-period ───────────────────────────────
// Réinitialiser la période (admin/cron uniquement)
router.post('/reset-period', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { runExpiration } = require('../cron/zora-expiration');
    await runExpiration();
    res.json({ success: true, message: 'Expiration exécutée avec succès' });
  } catch (error) {
    console.error('[zora/reset-period]', error.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
