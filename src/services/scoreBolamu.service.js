const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');

/**
 * Service Score Bolamu — Calcul du score de bien-être/engagement patient
 * Pondération :
 * - Assiduité RDV (30%) : RDV honorés / planifiés, 90 jours glissants
 * - Engagement Elonga (25%) : événements suivis, 90 jours, plafonné
 * - Activité communauté/club (20%) : interactions, 30 jours
 * - Régularité Zora (15%) : fréquence de gains (pas montant), 30 jours
 * - Suivi médical (10%) : consultations, 6 mois
 */

/**
 * Calcule le score Bolamu pour un patient
 * @param {string} patientPhone - Numéro de téléphone du patient
 * @returns {Promise<Object>} { score, tendance, label, composantes }
 */
async function calculerScoreBolamu(patientPhone) {
  const normalizedPhone = normalizePhone(patientPhone);
  
  // Dates de référence
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  
  // Période précédente (pour tendance)
  const ninetyTo180DaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
  const thirtyTo60DaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const sixTo12MonthsAgo = new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000);

  try {
    // 1. Assiduité RDV (30%) - RDV honorés / planifiés sur 90 jours
    // Corrigé le 12 juillet 2026 (audit Zora/Score) : lisait la table
    // `rendez_vous`, jamais écrite par aucun code applicatif (4 lignes de
    // test manuelles trouvées) — remplacée par `appointments`, la vraie
    // table de RDV utilisée par toute la plateforme. `honored`/`scheduled`
    // (et non `planned`) : le ratio d'origine comparait des ensembles de
    // statuts mutuellement exclusifs (complétés vs en attente), ce qui
    // pouvait dépasser 100% sans plafonnement — `scheduled` inclut
    // désormais aussi les RDV honorés, et le score est plafonné à 100%
    // comme les 4 autres composantes.
    const rdvQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'termine') AS honored,
        COUNT(*) FILTER (WHERE status IN ('confirme', 'en_cours', 'termine')) AS scheduled
      FROM appointments
      WHERE patient_phone = $1
        AND appointment_date >= $2
    `;
    const rdvResult = await pool.query(rdvQuery, [normalizedPhone, ninetyDaysAgo]);
    const rdvData = rdvResult.rows[0];
    const rdvScore = rdvData.scheduled > 0
      ? Math.min(rdvData.honored / rdvData.scheduled, 1) * 100
      : 0;

    // RDV période précédente pour tendance
    const rdvPrevQuery = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'termine') AS honored,
        COUNT(*) FILTER (WHERE status IN ('confirme', 'en_cours', 'termine')) AS scheduled
      FROM appointments
      WHERE patient_phone = $1
        AND appointment_date >= $2
        AND appointment_date < $3
    `;
    const rdvPrevResult = await pool.query(rdvPrevQuery, [normalizedPhone, ninetyTo180DaysAgo, ninetyDaysAgo]);
    const rdvPrevData = rdvPrevResult.rows[0];
    const rdvPrevScore = rdvPrevData.scheduled > 0
      ? Math.min(rdvPrevData.honored / rdvPrevData.scheduled, 1) * 100
      : 0;

    // 2. Engagement Elonga (25%) - Événements suivis (checked_in) sur 90 jours, plafonné à 5
    // Corrigé le 12 juillet 2026 (audit Zora/Score) : le filtre
    // `e.pillar = 'activite'` excluait de fait la quasi-totalité des
    // événements réels — 33 des 40 événements en base utilisent
    // pillar='sport' (le reste : nutrition/sante/anti_infectieux), et le
    // seul check-in réel jamais enregistré était sur un événement
    // pillar='nutrition'. Aucun check-in réel ne matchait donc jamais ce
    // filtre. Retiré : "Engagement Elonga" compte tout événement du
    // programme Elonga honoré, quel que soit le pilier.
    const elongaQuery = `
      SELECT COUNT(*) AS attended
      FROM event_registrations er
      JOIN elonga_events e ON er.event_id = e.id
      WHERE er.patient_phone = $1
        AND er.status = 'checked_in'
        AND er.checked_in_at >= $2
    `;
    const elongaResult = await pool.query(elongaQuery, [normalizedPhone, ninetyDaysAgo]);
    const elongaAttended = elongaResult.rows[0].attended || 0;
    const elongaScore = Math.min(elongaAttended / 5, 1) * 100; // Plafonné à 5 événements

    // Elonga période précédente
    const elongaPrevQuery = `
      SELECT COUNT(*) AS attended
      FROM event_registrations er
      JOIN elonga_events e ON er.event_id = e.id
      WHERE er.patient_phone = $1
        AND er.status = 'checked_in'
        AND er.checked_in_at >= $2
        AND er.checked_in_at < $3
    `;
    const elongaPrevResult = await pool.query(elongaPrevQuery, [normalizedPhone, ninetyTo180DaysAgo, ninetyDaysAgo]);
    const elongaPrevAttended = elongaPrevResult.rows[0].attended || 0;
    const elongaPrevScore = Math.min(elongaPrevAttended / 5, 1) * 100;

    // 3. Activité communauté/club (20%) - Membres actifs sur 30 jours
    const clubQuery = `
      SELECT COUNT(*) AS active_memberships
      FROM club_members
      WHERE patient_phone = $1
        AND is_active = true
        AND joined_at >= $2
    `;
    const clubResult = await pool.query(clubQuery, [normalizedPhone, thirtyDaysAgo]);
    const clubActive = clubResult.rows[0].active_memberships || 0;
    const clubScore = Math.min(clubActive / 3, 1) * 100; // Plafonné à 3 clubs actifs

    // Club période précédente
    const clubPrevQuery = `
      SELECT COUNT(*) AS active_memberships
      FROM club_members
      WHERE patient_phone = $1
        AND is_active = true
        AND joined_at >= $2
        AND joined_at < $3
    `;
    const clubPrevResult = await pool.query(clubPrevQuery, [normalizedPhone, thirtyTo60DaysAgo, thirtyDaysAgo]);
    const clubPrevActive = clubPrevResult.rows[0].active_memberships || 0;
    const clubPrevScore = Math.min(clubPrevActive / 3, 1) * 100;

    // 4. Régularité Zora (15%) - Fréquence de gains (nombre de transactions) sur 30 jours
    const zoraQuery = `
      SELECT COUNT(*) AS transaction_count
      FROM zora_ledger
      WHERE phone = $1
        AND earned_at >= $2
    `;
    const zoraResult = await pool.query(zoraQuery, [normalizedPhone, thirtyDaysAgo]);
    const zoraCount = zoraResult.rows[0].transaction_count || 0;
    const zoraScore = Math.min(zoraCount / 10, 1) * 100; // Plafonné à 10 transactions

    // Zora période précédente
    const zoraPrevQuery = `
      SELECT COUNT(*) AS transaction_count
      FROM zora_ledger
      WHERE phone = $1
        AND earned_at >= $2
        AND earned_at < $3
    `;
    const zoraPrevResult = await pool.query(zoraPrevQuery, [normalizedPhone, thirtyTo60DaysAgo, thirtyDaysAgo]);
    const zoraPrevCount = zoraPrevResult.rows[0].transaction_count || 0;
    const zoraPrevScore = Math.min(zoraPrevCount / 10, 1) * 100;

    // 5. Suivi médical (10%) - Consultations sur 6 mois
    const consultationQuery = `
      SELECT COUNT(*) AS consultation_count
      FROM consultations
      WHERE patient_phone = $1
        AND started_at >= $2
    `;
    const consultationResult = await pool.query(consultationQuery, [normalizedPhone, sixMonthsAgo]);
    const consultationCount = consultationResult.rows[0].consultation_count || 0;
    const consultationScore = Math.min(consultationCount / 2, 1) * 100; // Plafonné à 2 consultations

    // Consultation période précédente
    const consultationPrevQuery = `
      SELECT COUNT(*) AS consultation_count
      FROM consultations
      WHERE patient_phone = $1
        AND started_at >= $2
        AND started_at < $3
    `;
    const consultationPrevResult = await pool.query(consultationPrevQuery, [normalizedPhone, sixTo12MonthsAgo, sixMonthsAgo]);
    const consultationPrevCount = consultationPrevResult.rows[0].consultation_count || 0;
    const consultationPrevScore = Math.min(consultationPrevCount / 2, 1) * 100;

    // Score global pondéré
    const score = Math.round(
      (rdvScore * 0.30) +
      (elongaScore * 0.25) +
      (clubScore * 0.20) +
      (zoraScore * 0.15) +
      (consultationScore * 0.10)
    );

    // Score période précédente pour tendance
    const scorePrev = Math.round(
      (rdvPrevScore * 0.30) +
      (elongaPrevScore * 0.25) +
      (clubPrevScore * 0.20) +
      (zoraPrevScore * 0.15) +
      (consultationPrevScore * 0.10)
    );

    // Calcul tendance
    let tendance = 'stable';
    if (score > scorePrev + 5) tendance = 'up';
    else if (score < scorePrev - 5) tendance = 'down';

    // Label selon score
    let label = 'En progression';
    if (score >= 80) label = 'Excellent';
    else if (score >= 60) label = 'Très bon';
    else if (score >= 40) label = 'Bon';
    else if (score >= 20) label = 'En progression';
    else label = 'À démarrer';

    // Composantes détaillées
    const composantes = {
      assiduite_rdv: { score: Math.round(rdvScore), poids: 30, details: { honored: rdvData.honored, scheduled: rdvData.scheduled } },
      engagement_elonga: { score: Math.round(elongaScore), poids: 25, details: { attended: elongaAttended } },
      activite_club: { score: Math.round(clubScore), poids: 20, details: { active_memberships: clubActive } },
      regularite_zora: { score: Math.round(zoraScore), poids: 15, details: { transactions: zoraCount } },
      suivi_medical: { score: Math.round(consultationScore), poids: 10, details: { consultations: consultationCount } }
    };

    return {
      score,
      tendance,
      label,
      composantes
    };

  } catch (error) {
    console.error('[scoreBolamu] Erreur calcul score:', error);
    throw error;
  }
}

module.exports = {
  calculerScoreBolamu
};
