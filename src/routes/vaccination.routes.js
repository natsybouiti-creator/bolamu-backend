const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { normalizePhone } = require('../utils/phone');
const { awardZora } = require('../services/zora.service');
const { logAccess } = require('../services/dmn.service');

// Vaccinations administrées hors cabinet médecin (TC-033 interdit à pharmacie/
// laboratoire tout accès à health_records) — table dédiée vaccination_attestations.
const proOnly = (req, res, next) => {
  if (!['pharmacie', 'laboratoire'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Accès réservé aux pharmacies et laboratoires.' });
  }
  next();
};

// POST /api/v1/vaccination/attestation — enregistrer un vaccin administré
router.post('/attestation', authMiddleware, proOnly, async (req, res) => {
  const { patient_phone, vaccin_nom, dose_numero, date_administration, lot_vaccin, prochain_rappel_prevu } = req.body;
  const professionnelPhone = req.user.phone;
  const etablissementType = req.user.role;

  if (!patient_phone || !vaccin_nom || !date_administration) {
    return res.status(400).json({
      success: false,
      message: 'Champs obligatoires manquants : patient_phone, vaccin_nom, date_administration'
    });
  }

  const phone = normalizePhone(patient_phone);

  try {
    const patientCheck = await pool.query(`SELECT phone FROM users WHERE phone = $1 AND role = 'patient'`, [phone]);
    if (!patientCheck.rows.length) {
      return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    }

    const result = await pool.query(
      `INSERT INTO vaccination_attestations
        (patient_phone, professionnel_phone, etablissement_type, vaccin_nom, dose_numero, date_administration, lot_vaccin, prochain_rappel_prevu)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [phone, professionnelPhone, etablissementType, vaccin_nom, dose_numero || null, date_administration, lot_vaccin || null, prochain_rappel_prevu || null]
    );

    const record = result.rows[0];

    // BHP : journalisation obligatoire de l'écriture (patient + professionnel)
    logAccess(phone, professionnelPhone, 'update', {
      action: 'vaccination_attestation_creee',
      record_id: record.id,
      etablissement_type: etablissementType
    }, req.ip).catch(() => {});

    // Crédit Zora — ground_truth exigé par la règle (acte réalisé par un
    // professionnel habilité, jamais déclaratif patient).
    try {
      await awardZora({
        phone,
        action_type: 'vaccination',
        proof_class: 'ground_truth',
        proof_source: etablissementType,
        recording_method: null,
        proof_reference: 'va_' + record.id
      });
    } catch (zoraErr) {
      console.error('[ZORA] Erreur crédit vaccination (' + etablissementType + '):', zoraErr.message);
    }

    return res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('[VACCINATION] Erreur POST /attestation:', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

module.exports = router;
