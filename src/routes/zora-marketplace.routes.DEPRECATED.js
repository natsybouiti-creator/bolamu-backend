// ============================================================
// BOLAMU — Routes Marketplace Zora
// ============================================================
// DÉPRÉCIÉ — Tables zora_vouchers dépréciées (système remplacé par partner_vouchers)
// Routes neutralisées avec 410 Gone — ne pas réactiver
// Système canonique : partner_vouchers + voucher.service.js (routes /vouchers/*)
// ============================================================
const express = require('express');
const router = express.Router();

// Toutes les routes retournent 410 Gone (Gone) — ressource définitivement supprimée
router.all('*', (req, res) => {
  return res.status(410).json({
    success: false,
    error: 'GONE',
    message: 'Marketplace Zora déprécié — utiliser /api/v1/vouchers/* (partner_vouchers)'
  });
});

module.exports = router;
