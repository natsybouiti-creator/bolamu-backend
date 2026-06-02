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
 * GET /api/v1/smartflow/ssp/medicaments?q=XXX
 * Liste des médicaments du catalogue SSP (autocomplete ordonnance médecin)
 */
router.get('/smartflow/ssp/medicaments', authMiddleware, async (req, res) => {
  const pool = require('../config/db');
  const q = (req.query.q || '').trim();

  try {
    let result;
    if (q) {
      result = await pool.query(
        `SELECT nom, categorie, est_ssp
         FROM ssp_catalog
         WHERE type = 'medicament' AND nom ILIKE $1
         ORDER BY nom ASC
         LIMIT 50`,
        [`%${q}%`]
      );
    } else {
      result = await pool.query(
        `SELECT nom, categorie, est_ssp
         FROM ssp_catalog
         WHERE type = 'medicament'
         ORDER BY nom ASC`
      );
    }
    ok(res, result.rows);
  } catch (error) {
    console.error('[SmartFlow SSP medicaments]', error.message);
    err(res, 500, 'Erreur serveur');
  }
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

/**
 * GET /api/v1/smartflow/pharmacie/catalogue
 * Récupérer le catalogue de la pharmacie connectée
 */
router.get('/smartflow/pharmacie/catalogue', authMiddleware, async (req, res) => {
  if (req.user?.role !== 'pharmacie') {
    return err(res, 403, 'Accès réservé aux pharmacies');
  }

  const pool = require('../config/db');

  try {
    const result = await pool.query(
      `SELECT medicament_nom, prix_unitaire, unite, est_ssp
       FROM catalogue_pharmacie
       WHERE pharmacie_phone = $1 AND actif = true
       ORDER BY medicament_nom ASC`,
      [req.user.phone]
    );

    ok(res, result.rows);
  } catch (error) {
    console.error('[Catalogue Pharmacie GET]', error.message);
    err(res, 500, 'Erreur serveur');
  }
});

/**
 * POST /api/v1/smartflow/pharmacie/catalogue
 * Importer ou mettre à jour le catalogue de la pharmacie (upsert)
 */
router.post('/smartflow/pharmacie/catalogue', authMiddleware, async (req, res) => {
  if (req.user?.role !== 'pharmacie') {
    return err(res, 403, 'Accès réservé aux pharmacies');
  }

  const { medicaments } = req.body;

  if (!Array.isArray(medicaments) || medicaments.length === 0) {
    return err(res, 400, 'medicaments doit être un tableau non vide');
  }

  const pool = require('../config/db');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const med of medicaments) {
      const { medicament_nom, prix_unitaire, unite, est_ssp } = med;

      if (!medicament_nom || prix_unitaire === undefined || prix_unitaire === null) {
        await client.query('ROLLBACK');
        return err(res, 400, 'Champs manquants : medicament_nom, prix_unitaire');
      }

      // Normaliser le nom du médicament
      const medicament_nom_normalise = medicament_nom.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();

      await client.query(
        `INSERT INTO catalogue_pharmacie (pharmacie_phone, medicament_nom, medicament_nom_normalise, prix_unitaire, unite, est_ssp, actif)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         ON CONFLICT (pharmacie_phone, medicament_nom_normalise)
         DO UPDATE SET
           medicament_nom = EXCLUDED.medicament_nom,
           prix_unitaire = EXCLUDED.prix_unitaire,
           unite = EXCLUDED.unite,
           est_ssp = EXCLUDED.est_ssp,
           actif = true,
           updated_at = NOW()`,
        [req.user.phone, medicament_nom, medicament_nom_normalise, prix_unitaire, unite || 'comprimé', est_ssp || false]
      );
    }

    await client.query('COMMIT');
    ok(res, null, `${medicaments.length} médicament(s) importé(s) avec succès`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Catalogue Pharmacie POST]', error.message);
    err(res, 500, 'Erreur serveur');
  } finally {
    client.release();
  }
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

/**
 * GET /api/v1/smartflow/rh/employe/:phone/actes
 * Détail des actes d'un employé
 */
router.get('/smartflow/rh/employe/:phone/actes', authMiddleware, rhOnly, async (req, res) => {
  const { phone } = req.params;
  const { mois } = req.query;

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

    // Vérifier que l'employé appartient à l'entreprise
    const employeeResult = await pool.query(
      `SELECT ce.*, u.full_name
       FROM company_employees ce
       LEFT JOIN users u ON ce.phone = u.phone
       WHERE ce.phone = $1 AND ce.company_contract_id = $2 AND ce.status = 'active'`,
      [phone, contractId]
    );

    if (!employeeResult.rows.length) {
      return err(res, 404, 'Employé introuvable dans votre entreprise');
    }

    const employee = employeeResult.rows[0];

    // Récupérer les actes hors catalogue
    let query = `
      SELECT hct.*
      FROM hors_catalogue_transactions hct
      WHERE hct.company_contract_id = $1 AND hct.patient_phone = $2
    `;
    const params = [contractId, phone];

    if (mois) {
      query += ` AND TO_CHAR(hct.created_at, 'YYYY-MM') = $3`;
      params.push(mois);
    }

    query += ` ORDER BY hct.created_at DESC`;

    const actesResult = await pool.query(query, params);

    ok(res, {
      employee: {
        phone: employee.phone,
        name: employee.full_name,
        categorie_rh: employee.categorie_rh || 'employe'
      },
      actes: actesResult.rows
    });
  } catch (error) {
    console.error('[SmartFlow RH Employe Actes]', error.message);
    err(res, 500, 'Erreur serveur');
  }
});

/**
 * GET /api/v1/smartflow/rh/retenues/provisoire?mois=YYYY-MM
 * Calcul provisoire des retenues du mois (avant validation)
 */
router.get('/smartflow/rh/retenues/provisoire', authMiddleware, rhOnly, async (req, res) => {
  const { mois } = req.query;

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

    // Récupérer la configuration des catégories RH
    const configResult = await pool.query(
      `SELECT categorie_rh, pourcentage_salarie, plafond_mensuel
       FROM config_categories_rh
       WHERE company_contract_id = $1`,
      [contractId]
    );

    const configMap = {};
    configResult.rows.forEach(c => {
      configMap[c.categorie_rh] = {
        pourcentage: c.pourcentage_salarie,
        plafond: c.plafond_mensuel
      };
    });

    // Récupérer les employés actifs
    const employeesResult = await pool.query(
      `SELECT ce.phone, ce.categorie_rh, u.full_name
       FROM company_employees ce
       LEFT JOIN users u ON ce.phone = u.phone
       WHERE ce.company_contract_id = $1 AND ce.status = 'active'`,
      [contractId]
    );

    const retenues = [];

    for (const emp of employeesResult.rows) {
      const categorie = emp.categorie_rh || 'employe';
      const config = configMap[categorie] || { pourcentage: 20, plafond: 100000 };

      // Calculer le total hors catalogue du mois
      let query = `
        SELECT COALESCE(SUM(prix_plein), 0) as total_montant, COUNT(*) as nb_actes
        FROM hors_catalogue_transactions
        WHERE company_contract_id = $1 AND patient_phone = $2
      `;
      const params = [contractId, emp.phone];

      if (mois) {
        query += ` AND TO_CHAR(created_at, 'YYYY-MM') = $3`;
        params.push(mois);
      }

      const actesResult = await pool.query(query, params);
      const totalMontant = parseFloat(actesResult.rows[0].total_montant) || 0;
      const nbActes = parseInt(actesResult.rows[0].nb_actes) || 0;

      // Calculer la retenue (pourcentage du salaire, plafonné)
      // Pour l'instant, on utilise le montant hors catalogue comme base
      // Dans un vrai système, il faudrait le salaire brut de l'employé
      const pourcentage = config.pourcentage;
      const plafond = config.plafond;
      const montantRetenue = Math.min(totalMontant * pourcentage / 100, plafond);

      // Récupérer les détails des actes
      let actesQuery = `
        SELECT TO_CHAR(created_at, 'DD/MM/YYYY') as date,
               prestataire_type as type,
               prix_plein as montant,
               prestataire_phone as prestataire
        FROM hors_catalogue_transactions
        WHERE company_contract_id = $1 AND patient_phone = $2
      `;
      const actesParams = [contractId, emp.phone];

      if (mois) {
        actesQuery += ` AND TO_CHAR(created_at, 'YYYY-MM') = $3`;
        actesParams.push(mois);
      }

      actesQuery += ` ORDER BY created_at DESC`;

      const actesDetailsResult = await pool.query(actesQuery, actesParams);

      retenues.push({
        employee_phone: emp.phone,
        nom_complet: emp.full_name,
        categorie_rh: categorie,
        salaire_brut: 0, // À remplacer par le vrai salaire quand disponible
        montant_retenue: Math.round(montantRetenue),
        pourcentage_retenue: pourcentage,
        nombre_actes: nbActes,
        actes_details: actesDetailsResult.rows
      });
    }

    ok(res, retenues);
  } catch (error) {
    console.error('[SmartFlow RH Retenues Provisoire]', error.message);
    err(res, 500, 'Erreur serveur');
  }
});

/**
 * POST /api/v1/smartflow/rh/retenues/valider
 * Valider les retenues du mois (créer un snapshot dans retenues_validees)
 */
router.post('/smartflow/rh/retenues/valider', authMiddleware, rhOnly, async (req, res) => {
  const { mois } = req.body;

  if (!mois || !/^\d{4}-\d{2}$/.test(mois)) {
    return err(res, 400, 'Format mois invalide (YYYY-MM)');
  }

  const pool = require('../config/db');
  const client = await pool.connect();

  try {
    // Récupérer le contrat de l'entreprise du RH
    const contractResult = await client.query(
      `SELECT cc.id
       FROM company_contracts cc
       JOIN company_employees ce ON ce.company_contract_id = cc.id
       WHERE ce.phone = $1 AND ce.role = 'company_rh' AND ce.status = 'active'`,
      [req.user.phone]
    );

    if (!contractResult.rows.length) {
      await client.query('ROLLBACK');
      return err(res, 404, 'Contrat d\'entreprise introuvable');
    }

    const contractId = contractResult.rows[0].id;

    await client.query('BEGIN');

    // Récupérer la configuration des catégories RH
    const configResult = await client.query(
      `SELECT categorie_rh, pourcentage_salarie, plafond_mensuel
       FROM config_categories_rh
       WHERE company_contract_id = $1`,
      [contractId]
    );

    const configMap = {};
    configResult.rows.forEach(c => {
      configMap[c.categorie_rh] = {
        pourcentage: c.pourcentage_salarie,
        plafond: c.plafond_mensuel
      };
    });

    // Récupérer les employés actifs
    const employeesResult = await client.query(
      `SELECT ce.phone, ce.categorie_rh, u.full_name
       FROM company_employees ce
       LEFT JOIN users u ON ce.phone = u.phone
       WHERE ce.company_contract_id = $1 AND ce.status = 'active'`,
      [contractId]
    );

    // Calculer et insérer les retenues pour chaque employé
    for (const emp of employeesResult.rows) {
      const categorie = emp.categorie_rh || 'employe';
      const config = configMap[categorie] || { pourcentage: 20, plafond: 100000 };

      // Calculer le total hors catalogue du mois
      const actesResult = await client.query(
        `SELECT COALESCE(SUM(prix_plein), 0) as total_montant, COUNT(*) as nb_actes
         FROM hors_catalogue_transactions
         WHERE company_contract_id = $1 AND patient_phone = $2
         AND TO_CHAR(created_at, 'YYYY-MM') = $3`,
        [contractId, emp.phone, mois]
      );

      const totalMontant = parseFloat(actesResult.rows[0].total_montant) || 0;
      const nbActes = parseInt(actesResult.rows[0].nb_actes) || 0;

      // Calculer la retenue
      const pourcentage = config.pourcentage;
      const plafond = config.plafond;
      const montantRetenue = Math.min(totalMontant * pourcentage / 100, plafond);

      // Récupérer les détails des actes
      const actesDetailsResult = await client.query(
        `SELECT TO_CHAR(created_at, 'DD/MM/YYYY') as date,
                prestataire_type as type,
                prix_plein as montant,
                prestataire_phone as prestataire
         FROM hors_catalogue_transactions
         WHERE company_contract_id = $1 AND patient_phone = $2
         AND TO_CHAR(created_at, 'YYYY-MM') = $3
         ORDER BY created_at DESC`,
        [contractId, emp.phone, mois]
      );

      // Insérer dans retenues_validees
      await client.query(
        `INSERT INTO retenues_validees (company_contract_id, mois, employee_phone, nom_complet, categorie_rh, salaire_brut, montant_retenue, pourcentage_retenue, nombre_actes, actes_details, valide_par)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (company_contract_id, mois, employee_phone) DO NOTHING`,
        [contractId, mois, emp.phone, emp.full_name, categorie, 0, Math.round(montantRetenue), pourcentage, nbActes, JSON.stringify(actesDetailsResult.rows), req.user.phone]
      );
    }

    await client.query('COMMIT');
    ok(res, null, 'Retenues validées avec succès');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SmartFlow RH Retenues Valider]', error.message);
    err(res, 500, 'Erreur serveur');
  } finally {
    client.release();
  }
});

/**
 * GET /api/v1/smartflow/rh/config/categories
 * Récupérer la configuration des catégories RH
 */
router.get('/smartflow/rh/config/categories', authMiddleware, rhOnly, async (req, res) => {
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

    const result = await pool.query(
      `SELECT categorie_rh, pourcentage_salarie, plafond_mensuel
       FROM config_categories_rh
       WHERE company_contract_id = $1
       ORDER BY categorie_rh ASC`,
      [contractId]
    );

    ok(res, result.rows);
  } catch (error) {
    console.error('[SmartFlow RH Config Categories]', error.message);
    err(res, 500, 'Erreur serveur');
  }
});

/**
 * POST /api/v1/smartflow/rh/config/categories
 * Mettre à jour la configuration des catégories RH
 */
router.post('/smartflow/rh/config/categories', authMiddleware, rhOnly, async (req, res) => {
  const { categories } = req.body;

  if (!Array.isArray(categories) || categories.length === 0) {
    return err(res, 400, 'categories doit être un tableau non vide');
  }

  const pool = require('../config/db');
  const client = await pool.connect();

  try {
    // Récupérer le contrat de l'entreprise du RH
    const contractResult = await client.query(
      `SELECT cc.id
       FROM company_contracts cc
       JOIN company_employees ce ON ce.company_contract_id = cc.id
       WHERE ce.phone = $1 AND ce.role = 'company_rh' AND ce.status = 'active'`,
      [req.user.phone]
    );

    if (!contractResult.rows.length) {
      await client.query('ROLLBACK');
      return err(res, 404, 'Contrat d\'entreprise introuvable');
    }

    const contractId = contractResult.rows[0].id;

    await client.query('BEGIN');

    for (const cat of categories) {
      const { categorie_rh, pourcentage_salarie, plafond_mensuel } = cat;

      if (!categorie_rh || pourcentage_salarie === undefined || plafond_mensuel === undefined) {
        await client.query('ROLLBACK');
        return err(res, 400, 'Champs manquants : categorie_rh, pourcentage_salarie, plafond_mensuel');
      }

      await client.query(
        `INSERT INTO config_categories_rh (company_contract_id, categorie_rh, pourcentage_salarie, plafond_mensuel)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (company_contract_id, categorie_rh)
         DO UPDATE SET
           pourcentage_salarie = EXCLUDED.pourcentage_salarie,
           plafond_mensuel = EXCLUDED.plafond_mensuel,
           updated_at = NOW()`,
        [contractId, categorie_rh, pourcentage_salarie, plafond_mensuel]
      );
    }

    await client.query('COMMIT');
    ok(res, null, 'Configuration des catégories mise à jour');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SmartFlow RH Config Categories POST]', error.message);
    err(res, 500, 'Erreur serveur');
  } finally {
    client.release();
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

/**
 * GET /api/v1/smartflow/admin/transactions
 * Lister toutes les transactions hors catalogue (admin)
 */
router.get('/smartflow/admin/transactions', authMiddleware, adminOnly, async (req, res) => {
  try {
    const pool = require('../config/db');
    const result = await pool.query(
      `SELECT hct.*, cc.company_name, u.full_name as employee_name
       FROM hors_catalogue_transactions hct
       LEFT JOIN company_contracts cc ON hct.company_contract_id = cc.id
       LEFT JOIN users u ON hct.patient_phone = u.phone
       ORDER BY hct.created_at DESC
       LIMIT 100`
    );

    ok(res, result.rows, 'Transactions récupérées');
  } catch (error) {
    console.error('[SmartFlow Admin Transactions]', error.message);
    err(res, 500, 'Erreur serveur');
  }
});

module.exports = router;
