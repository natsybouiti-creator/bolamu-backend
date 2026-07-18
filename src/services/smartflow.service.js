// ============================================================
// BOLAMU — Smart Flow Service
// Module hors catalogue SSP pour grands comptes
// Principe : SSP gratuit couvert CDR, hors catalogue prix plein
// ============================================================

const pool = require('../config/db');
const logger = require('../config/logger');
const { sendAutoMessage } = require('./whatsapp.service');
const { sendToUser } = require('./push.service');

/**
 * Vérifie si une prestation (médicament, examen ou acte) est SSP (gratuit)
 * ou hors catalogue (prix plein). Source : ssp_catalog (migration 034).
 * Point d'entrée unique réutilisé par le module SmartFlow B2B (sans filtre de
 * type, comportement historique inchangé) et par le parcours de soins général
 * (ordonnances/prescriptions/lab_prescriptions, migration_059) qui, lui, filtre
 * par type pour éviter qu'un médicament et un examen au nom proche ne se confondent.
 * @param {string} nom_prestation - Nom de la prestation à vérifier
 * @param {string} [type] - Filtre optionnel : 'medicament' | 'examen' | 'acte'
 * @returns {Promise<{is_ssp: boolean, categorie: string, type: string, nom_generique: string}>}
 */
async function isSSP(nom_prestation, type = null) {
  try {
    const params = [`%${nom_prestation}%`];
    let query = `SELECT est_ssp, categorie, type, nom
       FROM ssp_catalog
       WHERE nom ILIKE $1`;
    if (type) {
      query += ` AND type = $2`;
      params.push(type);
    }
    query += ` ORDER BY est_ssp DESC LIMIT 1`;

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      return {
        is_ssp: result.rows[0].est_ssp,
        categorie: result.rows[0].categorie,
        type: result.rows[0].type,
        nom_generique: result.rows[0].nom
      };
    }
    
    // Hors catalogue par défaut si non trouvé
    return { is_ssp: false, categorie: null, type: null, nom_generique: null };
  } catch (error) {
    logger.error('[SmartFlow isSSP]', error.message);
    return { is_ssp: false, categorie: null, type: null, nom_generique: null };
  }
}

/**
 * Variante de isSSP() pour un texte libre pouvant contenir plus que le simple
 * nom (posologie, fréquence, durée — ex. "Amoxicilline 500mg - 3x/jour - 7 jours").
 * isSSP() cherche `nom ILIKE %texte%` (le nom du catalogue doit CONTENIR le texte
 * cherché) — ça ne marche que si le texte est déjà un nom court et exact. Ici on
 * inverse le sens : `texte ILIKE %nom%` (le texte libre doit CONTENIR un nom du
 * catalogue), ce qui fonctionne pour les champs texte libre de `prescriptions`,
 * `lab_prescriptions` et `ordonnance_items` (migration_059). `ORDER BY LENGTH(nom)
 * DESC` préfère la correspondance la plus longue/spécifique en cas d'ambiguïté.
 * @param {string} texte_libre - Texte contenant potentiellement un nom du catalogue
 * @param {string} [type] - Filtre optionnel : 'medicament' | 'examen' | 'acte'
 * @returns {Promise<{is_ssp: boolean, categorie: string, type: string, nom_generique: string}>}
 */
async function isSSPFreeText(texte_libre, type = null) {
  try {
    const params = [texte_libre || ''];
    let query = `SELECT est_ssp, categorie, type, nom
       FROM ssp_catalog
       WHERE $1 ILIKE '%' || nom || '%'`;
    if (type) {
      query += ` AND type = $2`;
      params.push(type);
    }
    query += ` ORDER BY LENGTH(nom) DESC, est_ssp DESC LIMIT 1`;

    const result = await pool.query(query, params);

    if (result.rows.length > 0) {
      return {
        is_ssp: result.rows[0].est_ssp,
        categorie: result.rows[0].categorie,
        type: result.rows[0].type,
        nom_generique: result.rows[0].nom
      };
    }

    return { is_ssp: false, categorie: null, type: null, nom_generique: null };
  } catch (error) {
    logger.error('[SmartFlow isSSPFreeText]', error.message);
    return { is_ssp: false, categorie: null, type: null, nom_generique: null };
  }
}

/**
 * Enregistre une transaction hors catalogue
 * @param {Object} data - { patient_phone, prestataire_phone, prestataire_type, libelle, prix_plein, ssp_reference_id, ssp_reference_type }
 * @returns {Promise<{success: boolean, message: string, data?: Object}>}
 */
async function enregistrerHorsCatalogue(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { patient_phone, prestataire_phone, prestataire_type, libelle, prix_plein, ssp_reference_id, ssp_reference_type } = data;
    
    // Vérifier que le patient est un abonné actif
    const patientCheck = await client.query(
      `SELECT is_active, statut_abonnement FROM users WHERE phone = $1`,
      [patient_phone]
    );
    
    if (!patientCheck.rows.length) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Patient introuvable' };
    }
    
    if (!patientCheck.rows[0].is_active) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Patient non actif' };
    }
    
    // Détecter si salarié grand compte (company_employees.contract_id/employee_phone,
    // pas company_contract_id/phone -- colonnes inexistantes, requête échouait
    // silencieusement dans le catch, transaction jamais enregistrée)
    const employeeCheck = await client.query(
      `SELECT contract_id FROM company_employees
       WHERE employee_phone = $1 AND status = 'active'`,
      [patient_phone]
    );

    const company_contract_id = employeeCheck.rows.length > 0 ? employeeCheck.rows[0].contract_id : null;
    
    // Insérer la transaction hors catalogue
    const result = await client.query(
      `INSERT INTO hors_catalogue_transactions 
       (patient_phone, prestataire_phone, prestataire_type, libelle, prix_plein, 
        company_contract_id, ssp_reference_id, ssp_reference_type, statut, notifie_patient_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'notifie', NOW())
       RETURNING *`,
      [patient_phone, prestataire_phone, prestataire_type, libelle, prix_plein, 
       company_contract_id, ssp_reference_id, ssp_reference_type]
    );
    
    const transaction = result.rows[0];
    
    // Notification patient
    const patientMessage = `Bolamu : Acte hors catalogue : ${libelle} — ${prix_plein} FCFA à régler directement au prestataire`;
    try {
      await sendAutoMessage(patient_phone, 'bolamu_hors_catalogue_patient', [libelle, prix_plein.toString()]);
      // TODO: supprimer sendBolamuSms après validation WhatsApp
      // await sendBolamuSms(patient_phone, patientMessage);
      await sendToUser(patient_phone, {
        titre: 'Acte hors catalogue',
        message: patientMessage,
        type: 'hors_catalogue',
        data: { transaction_id: transaction.id, libelle, prix_plein }
      });
    } catch (notifError) {
      logger.warn('[SmartFlow] Notification patient échouée:', notifError.message);
    }
    
    // Notification RH si grand compte — le contact RH est porté par
    // company_contracts (contact_phone/rh_phone), pas par company_employees
    // qui n'a ni colonne company_contract_id ni role (corrigé — avant :
    // requête cassée sur des colonnes inexistantes, échec silencieux).
    if (company_contract_id) {
      try {
        const rhCheck = await client.query(
          `SELECT COALESCE(rh_phone, contact_phone) AS phone
           FROM company_contracts
           WHERE id = $1 AND COALESCE(rh_phone, contact_phone) IS NOT NULL`,
          [company_contract_id]
        );

        if (rhCheck.rows.length > 0) {
          const rhPhone = rhCheck.rows[0].phone;
          await sendAutoMessage(rhPhone, 'bolamu_hors_catalogue_rh', [libelle, prix_plein.toString(), patient_phone]);
          const rhMessage = `Bolamu : Hors catalogue ${libelle} — ${prix_plein} FCFA pour employé ${patient_phone}`;
          await sendToUser(rhPhone, {
            titre: 'Hors catalogue employé',
            message: rhMessage,
            type: 'hors_catalogue_rh',
            data: { transaction_id: transaction.id, employee_phone: patient_phone, libelle, prix_plein }
          });
          
          // Marquer notification RH
          await client.query(
            `UPDATE hors_catalogue_transactions SET notifie_rh_at = NOW() WHERE id = $1`,
            [transaction.id]
          );
        }
      } catch (rhError) {
        logger.warn('[SmartFlow] Notification RH échouée:', rhError.message);
      }
    }
    
    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      ['hors_catalogue.created', prestataire_phone, 'hors_catalogue_transactions', transaction.id, 
       JSON.stringify({ libelle, prix_plein, patient_phone, company_contract_id })]
    );
    
    await client.query('COMMIT');
    
    return { 
      success: true, 
      message: 'Transaction hors catalogue enregistrée',
      data: transaction 
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[SmartFlow enregistrerHorsCatalogue]', error.message);
    return { success: false, message: 'Erreur serveur' };
  } finally {
    client.release();
  }
}

/**
 * Récupère les statistiques d'un partenaire pour un mois donné
 * @param {string} prestataire_phone - Téléphone du prestataire
 * @param {string} mois - Mois au format YYYY-MM
 * @returns {Promise<Object>}
 */
async function getStatsPartenaire(prestataire_phone, mois) {
  try {
    // Statistiques SSP (via prescriptions et appointments). is_ssp = TRUE requis --
    // sans ce filtre, nb_ssp comptait TOUTE prescription du médecin ce mois (SSP ou
    // pas), faussant le taux_conversion (hors_catalogue / total) qui est la métrique
    // centrale de tout le module SmartFlow.
    const sspResult = await pool.query(
      `SELECT COUNT(*) as nb_ssp
       FROM prescriptions p
       WHERE p.doctor_phone = $1
       AND p.is_ssp = TRUE
       AND TO_CHAR(p.created_at, 'YYYY-MM') = $2`,
      [prestataire_phone, mois]
    );
    
    // Statistiques hors catalogue
    const horsCatResult = await pool.query(
      `SELECT COUNT(*) as nb_hors_catalogue, 
              COALESCE(SUM(prix_plein), 0) as montant_hors_catalogue
       FROM hors_catalogue_transactions
       WHERE prestataire_phone = $1 
       AND TO_CHAR(created_at, 'YYYY-MM') = $2`,
      [prestataire_phone, mois]
    );
    
    const nb_ssp = parseInt(sspResult.rows[0].nb_ssp) || 0;
    const nb_hors_catalogue = parseInt(horsCatResult.rows[0].nb_hors_catalogue) || 0;
    const montant_hors_catalogue = parseFloat(horsCatResult.rows[0].montant_hors_catalogue) || 0;
    const total = nb_ssp + nb_hors_catalogue;
    const taux_conversion = total > 0 ? (nb_hors_catalogue / total * 100).toFixed(2) : 0;
    
    // Détail par catégorie
    const categorieResult = await pool.query(
      `SELECT mc.categorie, COUNT(*) as nb
       FROM hors_catalogue_transactions hct
       LEFT JOIN medicaments_catalogue mc ON hct.libelle ILIKE mc.nom_generique
       WHERE hct.prestataire_phone = $1 
       AND TO_CHAR(hct.created_at, 'YYYY-MM') = $2
       GROUP BY mc.categorie
       ORDER BY nb DESC`,
      [prestataire_phone, mois]
    );
    
    const detail_par_categorie = categorieResult.rows.map(row => ({
      categorie: row.categorie || 'Autre',
      nb: parseInt(row.nb)
    }));
    
    return {
      nb_ssp,
      nb_hors_catalogue,
      montant_hors_catalogue,
      taux_conversion: parseFloat(taux_conversion),
      detail_par_categorie
    };
    
  } catch (error) {
    logger.error('[SmartFlow getStatsPartenaire]', error.message);
    return {
      nb_ssp: 0,
      nb_hors_catalogue: 0,
      montant_hors_catalogue: 0,
      taux_conversion: 0,
      detail_par_categorie: []
    };
  }
}

/**
 * Génère l'export paie mensuel pour un contrat d'entreprise
 * @param {number} company_contract_id - ID du contrat d'entreprise
 * @param {string} mois - Mois au format YYYY-MM
 * @returns {Promise<{success: boolean, message: string, csv?: string}>}
 */
async function genererExportPaie(company_contract_id, mois) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Récupérer toutes les transactions hors catalogue du mois pour ce contrat
    const transactionsResult = await client.query(
      `SELECT hct.*, u.member_code as employee_code
       FROM hors_catalogue_transactions hct
       LEFT JOIN users u ON hct.patient_phone = u.phone
       WHERE hct.company_contract_id = $1 
       AND TO_CHAR(hct.created_at, 'YYYY-MM') = $2
       ORDER BY hct.patient_phone, hct.created_at`,
      [company_contract_id, mois]
    );
    
    const transactions = transactionsResult.rows;
    
    // Grouper par employé
    const groupedByEmployee = {};
    transactions.forEach(t => {
      const phone = t.patient_phone;
      if (!groupedByEmployee[phone]) {
        groupedByEmployee[phone] = {
          phone,
          code: t.employee_code || phone,
          total: 0,
          transactions: []
        };
      }
      groupedByEmployee[phone].total += parseFloat(t.prix_plein);
      groupedByEmployee[phone].transactions.push(t);
    });
    
    // Générer CSV
    const csvLines = [
      'Matricule,Code_Membre,Telephone,Nb_Actes,Montant_Total,Statut',
      ...Object.values(groupedByEmployee).map(emp => 
        `${emp.phone},${emp.code},${emp.phone},${emp.transactions.length},${emp.total.toFixed(2)},retenue_salaire`
      )
    ];
    
    const csv = csvLines.join('\n');
    
    // Insérer ou mettre à jour l'export paie mensuel
    const detailsJson = Object.values(groupedByEmployee).map(emp => ({
      employee_phone: emp.phone,
      employee_code: emp.code,
      nb_actes: emp.transactions.length,
      montant: emp.total,
      statut: 'retenue_salaire'
    }));
    
    const existingExport = await client.query(
      `SELECT id FROM export_paie_mensuel 
       WHERE company_contract_id = $1 AND mois = $2`,
      [company_contract_id, mois]
    );
    
    if (existingExport.rows.length > 0) {
      await client.query(
        `UPDATE export_paie_mensuel 
         SET nb_employes_actifs = $1, nb_actes_hors_catalogue = $2, 
             montant_hors_catalogue = $3, details_json = $4, 
             statut = 'finalise', exporte_at = NOW()
         WHERE id = $5`,
        [Object.keys(groupedByEmployee).length, transactions.length, 
         Object.values(groupedByEmployee).reduce((sum, emp) => sum + emp.total, 0),
         JSON.stringify(detailsJson), existingExport.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO export_paie_mensuel 
         (company_contract_id, mois, nb_employes_actifs, nb_actes_hors_catalogue, 
          montant_hors_catalogue, details_json, statut, exporte_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'finalise', NOW())`,
        [company_contract_id, mois, Object.keys(groupedByEmployee).length, transactions.length,
         Object.values(groupedByEmployee).reduce((sum, emp) => sum + emp.total, 0),
         JSON.stringify(detailsJson)]
      );
    }
    
    await client.query('COMMIT');
    
    return { 
      success: true, 
      message: 'Export paie généré avec succès',
      csv 
    };
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[SmartFlow genererExportPaie]', error.message);
    return { success: false, message: 'Erreur serveur' };
  } finally {
    client.release();
  }
}

/**
 * Récupère les statistiques globales Smart Flow pour l'admin
 * @param {string} mois - Mois au format YYYY-MM (optionnel)
 * @returns {Promise<Object>}
 */
async function getStatsAdmin(mois = null) {
  try {
    const params = mois ? [mois] : [];
    const moisFilter = mois ? `AND TO_CHAR(hct.created_at, 'YYYY-MM') = $1` : '';
    const moisFilterSsp = mois ? `AND TO_CHAR(p.created_at, 'YYYY-MM') = $1` : '';

    // Total actes SSP (is_ssp = TRUE requis, même bug que getStatsPartenaire --
    // sans ça, comptait toute prescription, SSP ou pas)
    const sspResult = await pool.query(
      `SELECT COUNT(*) as total FROM prescriptions p WHERE p.is_ssp = TRUE ${moisFilterSsp}`,
      params
    );

    // Total actes hors catalogue
    const horsCatResult = await pool.query(
      `SELECT COUNT(*) as total, COALESCE(SUM(prix_plein), 0) as montant
       FROM hors_catalogue_transactions hct
       WHERE 1=1 ${moisFilter}`,
      params
    );

    // Top partenaires hors catalogue
    const topPartenairesResult = await pool.query(
      `SELECT hct.prestataire_phone, hct.prestataire_type,
              COUNT(*) as nb_transactions,
              COALESCE(SUM(hct.prix_plein), 0) as total_montant
       FROM hors_catalogue_transactions hct
       WHERE 1=1 ${moisFilter}
       GROUP BY hct.prestataire_phone, hct.prestataire_type
       ORDER BY total_montant DESC
       LIMIT 10`,
      params
    );

    // Top grands comptes
    const grandsMoisFilter = mois ? `AND TO_CHAR(hct.created_at, 'YYYY-MM') = $1` : '';
    const topGrandsComptesResult = await pool.query(
      `SELECT hct.company_contract_id, cc.company_name,
              COUNT(*) as nb_transactions,
              COALESCE(SUM(hct.prix_plein), 0) as total_montant
       FROM hors_catalogue_transactions hct
       LEFT JOIN company_contracts cc ON hct.company_contract_id = cc.id
       WHERE hct.company_contract_id IS NOT NULL ${grandsMoisFilter}
       GROUP BY hct.company_contract_id, cc.company_name
       ORDER BY total_montant DESC
       LIMIT 10`,
      params
    );
    
    const total_ssp_actes = parseInt(sspResult.rows[0].total) || 0;
    const total_hors_cat_actes = parseInt(horsCatResult.rows[0].total) || 0;
    const total_hors_cat_montant = parseFloat(horsCatResult.rows[0].montant) || 0;
    const total_actes = total_ssp_actes + total_hors_cat_actes;
    const taux_conversion_global = total_actes > 0 ? (total_hors_cat_actes / total_actes * 100).toFixed(2) : 0;
    
    return {
      total_ssp_actes,
      total_hors_cat_actes,
      total_hors_cat_montant,
      taux_conversion_global: parseFloat(taux_conversion_global),
      top_partenaires_hors_cat: topPartenairesResult.rows.map(row => ({
        phone: row.prestataire_phone,
        type: row.prestataire_type,
        nb_transactions: parseInt(row.nb_transactions),
        total_montant: parseFloat(row.total_montant)
      })),
      top_grands_comptes: topGrandsComptesResult.rows.map(row => ({
        contract_id: row.company_contract_id,
        company_name: row.company_name || 'N/A',
        nb_transactions: parseInt(row.nb_transactions),
        total_montant: parseFloat(row.total_montant)
      }))
    };
    
  } catch (error) {
    logger.error('[SmartFlow getStatsAdmin]', error.message);
    return {
      total_ssp_actes: 0,
      total_hors_cat_actes: 0,
      total_hors_cat_montant: 0,
      taux_conversion_global: 0,
      top_partenaires_hors_cat: [],
      top_grands_comptes: []
    };
  }
}

/**
 * Calculer l'Indice de Capital Productif (ICP) pour un contrat d'entreprise
 * @param {number} contract_id - ID du contrat d'entreprise
 * @param {string} mois - Mois au format YYYY-MM
 * @returns {Promise<{success: boolean, message: string, data?: Object}>}
 */
async function calculerICP(contract_id, mois) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Récupérer tous les employés actifs du contrat
    const employeesResult = await client.query(
      `SELECT employee_phone FROM company_employees
       WHERE contract_id = $1 AND status = 'active'`,
      [contract_id]
    );

    const employees = employeesResult.rows;
    const nb_employes = employees.length;
    const nb_actifs = nb_employes; // Tous les employés actifs sont considérés actifs pour ICP

    // 2. Compter wellness_actions du mois pour tous les employés
    let totalWellnessPoints = 0;
    for (const emp of employees) {
      const wellnessResult = await client.query(
        `SELECT COALESCE(SUM(zora_points), 0) as total_points
         FROM wellness_actions
         WHERE patient_phone = $1
         AND TO_CHAR(validated_at, 'YYYY-MM') = $2`,
        [emp.employee_phone, mois]
      );
      totalWellnessPoints += parseFloat(wellnessResult.rows[0].total_points) || 0;
    }

    const avg_wellness = nb_actifs > 0 ? totalWellnessPoints / nb_actifs : 0;

    // 3. Compter consultations du mois (actes SSP via clearing_transactions)
    const consultationsResult = await client.query(
      `SELECT COUNT(*) as nb_consultations
       FROM clearing_transactions
       WHERE reference_type = 'appointment'
       AND TO_CHAR(created_at, 'YYYY-MM') = $1`,
      [mois]
    );
    const nb_consultations = parseInt(consultationsResult.rows[0].nb_consultations) || 0;

    // 4. Compter ordonnances du mois
    const ordonnancesResult = await client.query(
      `SELECT COUNT(*) as nb_ordonnances
       FROM prescriptions
       WHERE TO_CHAR(created_at, 'YYYY-MM') = $1`,
      [mois]
    );
    const nb_ordonnances = parseInt(ordonnancesResult.rows[0].nb_ordonnances) || 0;

    // 5. Calculer score ICP
    const taux_activite = nb_employes > 0 ? (nb_actifs / nb_employes * 100) : 0;
    const score_icp = (taux_activite * 0.4)
                    + (avg_wellness / 10 * 0.3)
                    + (nb_employes > 0 ? (nb_consultations / nb_employes * 30) : 0);

    // 6. UPSERT INTO icp_scores
    await client.query(
      `INSERT INTO icp_scores
       (contract_id, mois, nb_employes, nb_actifs, taux_activite,
        avg_wellness, nb_consultations, nb_ordonnances, score_icp, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (contract_id, mois)
       DO UPDATE SET
         nb_employes = EXCLUDED.nb_employes,
         nb_actifs = EXCLUDED.nb_actifs,
         taux_activite = EXCLUDED.taux_activite,
         avg_wellness = EXCLUDED.avg_wellness,
         nb_consultations = EXCLUDED.nb_consultations,
         nb_ordonnances = EXCLUDED.nb_ordonnances,
         score_icp = EXCLUDED.score_icp,
         generated_at = NOW()`,
      [contract_id, mois, nb_employes, nb_actifs, taux_activite,
       avg_wellness, nb_consultations, nb_ordonnances, score_icp]
    );

    // 7. UPSERT INTO smartflow_reports
    const reportData = {
      contract_id,
      mois,
      nb_employes,
      nb_actifs,
      taux_activite: parseFloat(taux_activite.toFixed(2)),
      avg_wellness: parseFloat(avg_wellness.toFixed(2)),
      nb_consultations,
      nb_ordonnances,
      score_icp: parseFloat(score_icp.toFixed(2)),
      generated_at: new Date().toISOString()
    };

    await client.query(
      `INSERT INTO smartflow_reports
       (contract_id, mois, report_data, generated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (contract_id, mois)
       DO UPDATE SET
         report_data = EXCLUDED.report_data,
         generated_at = NOW()`,
      [contract_id, mois, JSON.stringify(reportData)]
    );

    await client.query('COMMIT');

    return {
      success: true,
      message: 'ICP calculé avec succès',
      data: {
        score_icp: parseFloat(score_icp.toFixed(2)),
        taux_activite: parseFloat(taux_activite.toFixed(2)),
        avg_wellness: parseFloat(avg_wellness.toFixed(2)),
        nb_employes,
        nb_actifs,
        nb_consultations,
        nb_ordonnances
      }
    };

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[SmartFlow calculerICP]', error.message);
    return { success: false, message: 'Erreur serveur' };
  } finally {
    client.release();
  }
}

module.exports = {
  isSSP,
  isSSPFreeText,
  enregistrerHorsCatalogue,
  getStatsPartenaire,
  genererExportPaie,
  getStatsAdmin,
  calculerICP
};
