// ============================================================
// BOLAMU — Smart Flow Service
// Module hors catalogue SSP pour grands comptes
// Principe : SSP gratuit couvert CDR, hors catalogue prix plein
// ============================================================

const pool = require('../config/db');
const logger = require('../config/logger');
const { sendBolamuSms } = require('./sms.service');
const { sendToUser } = require('./push.service');

/**
 * Vérifie si un médicament est SSP (gratuit) ou hors catalogue (prix plein)
 * @param {string} nom_medicament - Nom du médicament à vérifier
 * @returns {Promise<{is_ssp: boolean, categorie: string, nom_generique: string}>}
 */
async function isSSP(nom_medicament) {
  try {
    const result = await pool.query(
      `SELECT is_ssp, categorie, nom_generique 
       FROM medicaments_catalogue 
       WHERE nom_generique ILIKE $1 AND is_active = true 
       LIMIT 1`,
      [`%${nom_medicament}%`]
    );
    
    if (result.rows.length > 0) {
      return {
        is_ssp: result.rows[0].is_ssp,
        categorie: result.rows[0].categorie,
        nom_generique: result.rows[0].nom_generique
      };
    }
    
    // Hors catalogue par défaut si non trouvé
    return { is_ssp: false, categorie: null, nom_generique: null };
  } catch (error) {
    logger.error('[SmartFlow isSSP]', error.message);
    return { is_ssp: false, categorie: null, nom_generique: null };
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
    
    // Détecter si salarié grand compte
    const employeeCheck = await client.query(
      `SELECT company_contract_id FROM company_employees 
       WHERE phone = $1 AND status = 'active'`,
      [patient_phone]
    );
    
    const company_contract_id = employeeCheck.rows.length > 0 ? employeeCheck.rows[0].company_contract_id : null;
    
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
      await sendBolamuSms(patient_phone, patientMessage);
      await sendToUser(patient_phone, {
        titre: 'Acte hors catalogue',
        message: patientMessage,
        type: 'hors_catalogue',
        data: { transaction_id: transaction.id, libelle, prix_plein }
      });
    } catch (notifError) {
      logger.warn('[SmartFlow] Notification patient échouée:', notifError.message);
    }
    
    // Notification RH si grand compte
    if (company_contract_id) {
      try {
        const rhCheck = await client.query(
          `SELECT phone FROM company_employees 
           WHERE company_contract_id = $1 AND role = 'company_rh' AND status = 'active'`,
          [company_contract_id]
        );
        
        if (rhCheck.rows.length > 0) {
          const rhPhone = rhCheck.rows[0].phone;
          const rhMessage = `Bolamu : Hors catalogue ${libelle} — ${prix_plein} FCFA pour employé ${patient_phone}`;
          await sendBolamuSms(rhPhone, rhMessage);
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
       VALUES ($1, $2, $3, $4, $5)`,
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
    // Statistiques SSP (via prescriptions et appointments)
    const sspResult = await pool.query(
      `SELECT COUNT(*) as nb_ssp 
       FROM prescriptions p
       WHERE p.doctor_phone = $1 
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
      `SELECT hct.*, u.full_name as employee_name
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
          name: t.employee_name || phone,
          total: 0,
          transactions: []
        };
      }
      groupedByEmployee[phone].total += parseFloat(t.prix_plein);
      groupedByEmployee[phone].transactions.push(t);
    });
    
    // Générer CSV
    const csvLines = [
      'Matricule,Nom,Telephone,Nb_Actes,Montant_Total,Statut',
      ...Object.values(groupedByEmployee).map(emp => 
        `${emp.phone},${emp.name},${emp.phone},${emp.transactions.length},${emp.total.toFixed(2)},retenue_salaire`
      )
    ];
    
    const csv = csvLines.join('\n');
    
    // Insérer ou mettre à jour l'export paie mensuel
    const detailsJson = Object.values(groupedByEmployee).map(emp => ({
      employee_phone: emp.phone,
      employee_name: emp.name,
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
    const moisFilter = mois ? `AND TO_CHAR(hct.created_at, 'YYYY-MM') = '${mois}'` : '';
    
    // Total actes SSP
    const sspResult = await pool.query(
      `SELECT COUNT(*) as total FROM prescriptions p
       WHERE 1=1 ${mois ? `AND TO_CHAR(p.created_at, 'YYYY-MM') = '${mois}'` : ''}`
    );
    
    // Total actes hors catalogue
    const horsCatResult = await pool.query(
      `SELECT COUNT(*) as total, COALESCE(SUM(prix_plein), 0) as montant
       FROM hors_catalogue_transactions hct
       WHERE 1=1 ${moisFilter}`
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
       LIMIT 10`
    );
    
    // Top grands comptes
    const topGrandsComptesResult = await pool.query(
      `SELECT hct.company_contract_id, cc.company_name,
              COUNT(*) as nb_transactions,
              COALESCE(SUM(hct.prix_plein), 0) as total_montant
       FROM hors_catalogue_transactions hct
       LEFT JOIN company_contracts cc ON hct.company_contract_id = cc.id
       WHERE hct.company_contract_id IS NOT NULL ${moisFilter}
       GROUP BY hct.company_contract_id, cc.company_name
       ORDER BY total_montant DESC
       LIMIT 10`
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

module.exports = {
  isSSP,
  enregistrerHorsCatalogue,
  getStatsPartenaire,
  genererExportPaie,
  getStatsAdmin
};
