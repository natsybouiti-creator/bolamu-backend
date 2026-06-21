// ============================================================
// BOLAMU — AI Consult Service (Sprint 9)
// Module d'assistance IA pour médecins — Amina
// ============================================================

const pool = require('../config/db');
const logger = require('../config/logger');
const Anthropic = require('@anthropic-ai/sdk');

// Initialiser client Anthropic
let anthropic = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
  logger.info('[AI Consult] Client Anthropic initialisé');
} else {
  logger.warn('[AI Consult] ANTHROPIC_API_KEY non configuré');
}

// Prompt système pour briefing
const SYSTEM_PROMPT_BRIEFING = `Tu es un assistant médical au Congo-Brazzaville. Réponds en français. Fournis un briefing structuré pour le médecin. Format de réponse attendu (JSON) :
{
  "antecedents_pertinents": "Résumé des antécédents médicaux pertinents",
  "derniere_consultation": "Détails de la dernière consultation",
  "alertes_interactions": "Alertes d'interactions médicamenteuses ou contre-indications",
  "symptomes_declares": "Résumé des symptômes déclarés par le patient"
}`;

// Prompt système pour analyse tricolore
const SYSTEM_PROMPT_TRICOLOR = `Tu es un expert en pharmacologie clinique au Congo-Brazzaville. Analyse le diagnostic et les médicaments pour détecter :
- Interactions médicamenteuses
- Dosages inhabituels
- Conformité aux protocoles OMS Congo-B
Réponds en français avec un statut (green/orange/red) et un message explicatif. Format JSON attendu :
{
  "status": "green|orange|red",
  "message": "Message explicatif",
  "suggestions": ["suggestion1", "suggestion2"]
}`;

/**
 * Génère un briefing IA pour un RDV
 * @param {number} appointment_id - ID du RDV
 * @param {string} doctor_phone - Téléphone du médecin
 * @returns {Promise<Object>}
 */
async function generateBriefing(appointment_id, doctor_phone) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Récupérer les données du RDV
    const appointmentResult = await client.query(
      `SELECT a.*, u.full_name, u.phone as patient_phone
       FROM appointments a
       JOIN users u ON a.patient_phone = u.phone
       WHERE a.id = $1`,
      [appointment_id]
    );

    if (!appointmentResult.rows.length) {
      await client.query('ROLLBACK');
      return { error: 'RDV introuvable' };
    }

    const appointment = appointmentResult.rows[0];
    const patientPhone = appointment.patient_phone;

    // Récupérer l'historique RDV 6 derniers mois
    const historyResult = await client.query(
      `SELECT a.appointment_date, a.status, a.motif
       FROM appointments a
       WHERE a.patient_phone = $1
       AND a.appointment_date >= NOW() - INTERVAL '6 months'
       ORDER BY a.appointment_date DESC
       LIMIT 10`,
      [patientPhone]
    );

    // Récupérer les constantes médicales
    const constantesResult = await client.query(
      `SELECT * FROM constantes_medicales WHERE patient_phone = $1
       ORDER BY created_at DESC LIMIT 1`,
      [patientPhone]
    );

    // Récupérer la dernière ordonnance
    const prescriptionResult = await client.query(
      `SELECT p.*, d.full_name as doctor_name
       FROM prescriptions p
       JOIN doctors d ON p.doctor_phone = d.phone
       WHERE p.patient_phone = $1
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [patientPhone]
    );

    // Récupérer les symptômes pre-RDV
    const symptomsResult = await client.query(
      `SELECT * FROM appointment_symptoms WHERE appointment_id = $1`,
      [appointment_id]
    );

    // Pseudonymiser les données avant envoi API
    const patientId = `PATIENT_${appointment_id}`;
    const briefingData = {
      patient_id: patientId,
      historique_rdv: historyResult.rows.map(r => ({
        date: r.appointment_date,
        statut: r.status,
        motif: r.motif
      })),
      constantes: constantesResult.rows[0] || null,
      derniere_ordonnance: prescriptionResult.rows[0] || null,
      symptomes: symptomsResult.rows[0] || null
    };

    // Appeler API Anthropic avec timeout 10 secondes
    let briefing = null;
    if (anthropic) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });

      const apiPromise = anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        system: SYSTEM_PROMPT_BRIEFING,
        messages: [
          {
            role: 'user',
            content: `Génère un briefing pour ce patient (données pseudonymisées) :\n${JSON.stringify(briefingData, null, 2)}`
          }
        ]
      });

      try {
        const result = await Promise.race([apiPromise, timeoutPromise]);
        const content = result.content[0].text;
        briefing = JSON.parse(content);
      } catch (apiError) {
        logger.error('[AI Consult] Erreur API Anthropic:', apiError.message);
        briefing = { error: 'Analyse indisponible' };
      }
    } else {
      briefing = { error: 'Service IA non configuré' };
    }

    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      ['ai_consult_briefing', doctor_phone, 'appointments', appointment_id, JSON.stringify({ patient_id })]
    );

    await client.query('COMMIT');

    return briefing;

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[AI Consult generateBriefing]', error.message);
    return { error: 'Erreur serveur' };
  } finally {
    client.release();
  }
}

/**
 * Analyse tricolore (interactions, dosages, protocoles)
 * @param {string} diagnosis - Diagnostic
 * @param {string} medications - Médicaments prescrits
 * @param {string} patient_phone - Téléphone du patient
 * @param {string} doctor_phone - Téléphone du médecin
 * @returns {Promise<Object>}
 */
async function analyzeTricolor(diagnosis, medications, patient_phone, doctor_phone) {
  try {
    // Appeler API Anthropic avec timeout 8 secondes
    let analysis = null;
    if (anthropic) {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 8000);
      });

      const apiPromise = anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        system: SYSTEM_PROMPT_TRICOLOR,
        messages: [
          {
            role: 'user',
            content: `Analyse ce diagnostic et ces médicaments :\nDiagnostic: ${diagnosis}\nMédicaments: ${medications}`
          }
        ]
      });

      try {
        const result = await Promise.race([apiPromise, timeoutPromise]);
        const content = result.content[0].text;
        analysis = JSON.parse(content);
      } catch (apiError) {
        logger.error('[AI Consult] Erreur API Anthropic tricolor:', apiError.message);
        analysis = { status: 'green', message: 'Analyse indisponible', suggestions: [] };
      }
    } else {
      analysis = { status: 'green', message: 'Service IA non configuré', suggestions: [] };
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      ['ai_consult_tricolor', doctor_phone, 'users', patient_phone, JSON.stringify({ diagnosis, medications })]
    );

    return analysis;

  } catch (error) {
    logger.error('[AI Consult analyzeTricolor]', error.message);
    return { status: 'green', message: 'Erreur serveur', suggestions: [] };
  }
}

/**
 * Génère une suggestion de renouvellement d'ordonnance
 * @param {string} patient_phone - Téléphone du patient
 * @param {string} doctor_phone - Téléphone du médecin
 * @returns {Promise<Object>}
 */
async function generateRenewal(patient_phone, doctor_phone) {
  try {
    // Vérifier éligibilité : pathologie chronique stable + dernière consultation < 3 mois
    const lastConsultationResult = await pool.query(
      `SELECT a.appointment_date, a.motif
       FROM appointments a
       WHERE a.patient_phone = $1 AND a.status = 'termine'
       ORDER BY a.appointment_date DESC
       LIMIT 1`,
      [patient_phone]
    );

    if (!lastConsultationResult.rows.length) {
      return { eligible: false, suggestion: null, reason: 'Aucune consultation précédente trouvée' };
    }

    const lastConsultation = lastConsultationResult.rows[0];
    const lastDate = new Date(lastConsultation.appointment_date);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    if (lastDate < threeMonthsAgo) {
      return { eligible: false, suggestion: null, reason: 'Dernière consultation datant de plus de 3 mois' };
    }

    // Récupérer la dernière ordonnance
    const prescriptionResult = await pool.query(
      `SELECT p.*
       FROM prescriptions p
       WHERE p.patient_phone = $1
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [patient_phone]
    );

    if (!prescriptionResult.rows.length) {
      return { eligible: false, suggestion: null, reason: 'Aucune ordonnance précédente trouvée' };
    }

    const prescription = prescriptionResult.rows[0];

    // Vérifier si pathologie chronique (basé sur le motif)
    const chronicKeywords = ['diabète', 'hypertension', 'asthme', 'épilepsie', 'chronique', 'htn', 'diabetes'];
    const isChronic = chronicKeywords.some(keyword => 
      (lastConsultation.motif || '').toLowerCase().includes(keyword) ||
      (prescription.motif || '').toLowerCase().includes(keyword)
    );

    if (!isChronic) {
      return { eligible: false, suggestion: null, reason: 'Pathologie non chronique détectée' };
    }

    // Copier dernière ordonnance dans suggestion
    const suggestion = {
      motif: prescription.motif,
      medications: prescription.medications,
      instructions: prescription.instructions,
      note: 'Suggestion de renouvellement basée sur la dernière ordonnance'
    };

    // Audit log
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      ['ai_consult_renewal', doctor_phone, 'prescriptions', prescription.id, JSON.stringify({ patient_phone })]
    );

    return { eligible: true, suggestion, reason: 'Pathologie chronique stable, dernière consultation < 3 mois' };

  } catch (error) {
    logger.error('[AI Consult generateRenewal]', error.message);
    return { eligible: false, suggestion: null, reason: 'Erreur serveur' };
  }
}

module.exports = {
  generateBriefing,
  analyzeTricolor,
  generateRenewal
};
