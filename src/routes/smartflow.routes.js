// ============================================================
// BOLAMU — Routes Smart Flow
// Module hors catalogue SSP pour grands comptes
// ============================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const { isSSP, enregistrerHorsCatalogue, getStatsPartenaire, genererExportPaie, getStatsAdmin } = require('../services/smartflow.service');
const { ok, err } = require('../utils/apiResponse');
const { ROLES } = require('../utils/constants');

// Middleware pour vérifier que l'utilisateur est un prestataire (pharmacie, labo, médecin)
function prestataireOnly(req, res, next) {
  if (!['pharmacie', 'laboratoire', 'doctor'].includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Accès réservé aux prestataires.' });
  }
  next();
}

// Middleware pour vérifier que l'utilisateur est RH grand compte
function rhOnly(req, res, next) {
  if (req.user?.role !== 'company_rh') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux RH grands comptes.' });
  }
  next();
}

// Middleware admin
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
  }
  next();
}

// ============================================================
// ROUTES PRESTATAIRES (pharmacie, labo, médecin)
// ============================================================

/**
 * POST /api/v1/smartflow/hors-catalogue
 * Enregistrer une transaction hors catalogue
 */
router.post('/smartflow/hors-catalogue', authMiddleware, prestataireOnly, async (req, res) => {
  const { patient_phone, prestataire_phone, prestataire_type, libelle, prix_plein, ssp_reference_id, ssp_reference_type } = req.body;
  
  if (!patient_phone || !prestataire_phone || !prestataire_type || !libelle || !prix_plein) {
    return err(res, 400, 'Champs manquants : patient_phone, prestataire_phone, prestataire_type, libelle, prix_plein');
  }
  
  if (!['pharmacie', 'laboratoire', 'doctor'].includes(prestataire_type)) {
    return err(res, 400, 'prestataire_type invalide (pharmacie, laboratoire, doctor)');
  }
  
  if (prestataire_phone !== req.user.phone) {
    return err(res, 403, 'Vous ne pouvez enregistrer que vos propres transactions');
  }
  
  const result = await enregistrerHorsCatalogue({
    patient_phone,
    prestataire_phone,
    prestataire_type,
    libelle,
    prix_plein,
    ssp_reference_id,
    ssp_reference_type
  });
  
  if (result.success) {
    ok(res, result.data, result.message);
  } else {
    err(res, 500, result.message);
  }
});

/**
 * GET /api/v1/smartflow/medicaments/check?nom=XXX
 * Vérifier si un médicament est SSP ou hors catalogue
 */
router.get('/smartflow/medicaments/check', authMiddleware, async (req, res) => {
  const { nom } = req.query;
  
  if (!nom) {
    return err(res, 400, 'Paramètre nom requis');
  }
  
  const result = await isSSP(nom);
  ok(res, result);
});

/**
 * GET /api/v1/smartflow/stats/moi?mois=YYYY-MM
 * Statistiques du prestataire connecté
 */
router.get('/smartflow/stats/moi', authMiddleware, prestataireOnly, async (req, res) => {
  const { mois } = req.query;
  
  // Par défaut, mois courant
  const currentMonth = new Date().toISOString().slice(0, 7);
  const targetMonth = mois || currentMonth;
  
  const result = await getStatsPartenaire(req.user.phone, targetMonth);
  ok(res, result);
});

// ============================================================
// ROUTES RH GRAND COMPTE
// ============================================================

/**
 * GET /api/v1/smartflow/rh/dashboard
 * Dashboard RH : vue temps réel employés + SSP + hors catalogue
 */
router.get('/smartflow/rh/dashboard', authMiddleware, rhOnly, async (req, res) => {
  const pool = require('../config/db');
  
  try {
    // Récupérer le contrat de l'entreprise du RH
    const contractResult = await pool.query(
      `SELECT cc.id, cc.company_name 
       FROM company_contracts cc
       JOIN company_employees ce ON ce.company_contract_id = cc.id
       WHERE ce.phone = $1 AND ce.role = 'company_rh' AND ce.status = 'active'`,
      [req.user.phone]
    );
    
    if (!contractResult.rows.length) {
      return err(res, 404, 'Contrat d\'entreprise introuvable');
    }
    
    const contract = contractResult.rows[0];
    const contractId = contract.id;
    
    // Statistiques employés actifs
    const employeesResult = await pool.query(
      `SELECT COUNT(*) as total 
       FROM company_employees 
       WHERE company_contract_id = $1 AND status = 'active'`,
      [contractId]
    );
    
    // Statistiques hors catalogue du mois courant
    const currentMonth = new Date().toISOString().slice(0, 7);
    const horsCatResult = await pool.query(
      `SELECT COUNT(*) as nb_transactions, 
              COALESCE(SUM(prix_plein), 0) as total_montant,
              COUNT(DISTINCT patient_phone) as nb_employes_concernes
       FROM hors_catalogue_transactions
       WHERE company_contract_id = $1 
       AND TO_CHAR(created_at, 'YYYY-MM') = $2`,
      [contractId, currentMonth]
    );
    
    // Dernières transactions
    const recentTransactionsResult = await pool.query(
      `SELECT hct.*, u.full_name as employee_name
       FROM hors_catalogue_transactions hct
       LEFT JOIN users u ON hct.patient_phone = u.phone
       WHERE hct.company_contract_id = $1
       ORDER BY hct.created_at DESC
       LIMIT 20`,
      [contractId]
    );
    
    ok(res, {
      company: {
        id: contract.id,
        name: contract.company_name
      },
      employees: {
        total_actifs: parseInt(employeesResult.rows[0].total) || 0
      },
      hors_catalogue_mois: {
        nb_transactions: parseInt(horsCatResult.rows[0].nb_transactions) || 0,
        total_montant: parseFloat(horsCatResult.rows[0].total_montant) || 0,
        nb_employes_concernes: parseInt(horsCatResult.rows[0].nb_employes_concernes) || 0
      },
      recent_transactions: recentTransactionsResult.rows
    });
    
  } catch (error) {
    console.error('[SmartFlow RH Dashboard]', error.message);
    err(res, 500, 'Erreur serveur');
  }
});

/**
 * GET /api/v1/smartflow/rh/export/:mois
 * Générer et télécharger l'export paie mensuel (CSV)
 */
router.get('/smartflow/rh/export/:mois', authMiddleware, rhOnly, async (req, res) => {
  const { mois } = req.params;
  
  // Valider format mois (YYYY-MM)
  if (!/^\d{4}-\d{2}$/.test(mois)) {
    return err(res, 400, 'Format mois invalide (YYYY-MM)');
  }
  
  const pool = require('../config/db');
  
  try {
    // Récupérer le contrat de l'entreprise du RH
    const contractResult = await pool.query(
      `SELECT cc.id 
       FROM company_contracts cc
       JOIN company_employees ce ON ce.company_contract_id = cc.id
       WHERE ce.phone = $1 AND ce.role = 'company_rh' AND ce.status = 'active'`,
      [req.user.phone]
    );
    
    if (!contractResult.rows.length) {
      return err(res, 404, 'Contrat d\'entreprise introuvable');
    }
    
    const contractId = contractResult.rows[0].id;
    
    const result = await genererExportPaie(contractId, mois);
    
    if (result.success) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_paie_${mois}.csv"`);
      res.send(result.csv);
    } else {
      err(res, 500, result.message);
    }
    
  } catch (error) {
    console.error('[SmartFlow RH Export]', error.message);
    err(res, 500, 'Erreur serveur');
  }
});

// ============================================================
// ROUTES ADMIN
// ============================================================

/**
 * GET /api/v1/admin/smartflow/stats?mois=YYYY-MM
 * Statistiques globales Smart Flow pour admin
 */
router.get('/admin/smartflow/stats', authMiddleware, adminOnly, async (req, res) => {
  const { mois } = req.query;
  const result = await getStatsAdmin(mois);
  ok(res, result);
});

/**
 * GET /api/v1/admin/smartflow/partenaire/:phone?mois=YYYY-MM
 * Statistiques détaillées d'un partenaire spécifique
 */
router.get('/admin/smartflow/partenaire/:phone', authMiddleware, adminOnly, async (req, res) => {
  const { phone } = req.params;
  const { mois } = req.query;
  
  // Valider format téléphone
  if (!/^\+?[0-9]{8,15}$/.test(phone)) {
    return err(res, 400, 'Numéro de téléphone invalide');
  }
  
  // Par défaut, mois courant
  const currentMonth = new Date().toISOString().slice(0, 7);
  const targetMonth = mois || currentMonth;
  
  const result = await getStatsPartenaire(phone, targetMonth);
  ok(res, result);
});

module.exports = router;
