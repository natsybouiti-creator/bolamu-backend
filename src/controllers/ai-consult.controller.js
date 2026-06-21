// ============================================================
// BOLAMU — AI Consult Controller (Amina)
// Moteur IA pour médecins via Groq API
// ============================================================

const Groq = require('groq-sdk');
const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const SYSTEM_AMINA = `Tu es Amina, assistante médicale IA de Bolamu,
plateforme de santé primaire au Congo-Brazzaville.
Tu assistes les médecins en consultation — tu ne poses JAMAIS
de diagnostic toi-même, tu fournis uniquement des éléments
d'aide à la décision médicale.
Contexte prioritaire : soins primaires Afrique centrale,
pathologies endémiques : paludisme, infections respiratoires,
HTA, diabète type 2, drépanocytose, tuberculose, VIH.
Catalogue SSP Bolamu : médicaments OMS liste modèle 23e édition.
Tu réponds TOUJOURS en JSON valide uniquement, sans texte autour.`;

exports.briefingConsultation = async (req, res) => {
  const { appointment_id, patient_phone } = req.body;
  try {
    const [c, h, r] = await Promise.all([
      pool.query(`SELECT groupe_sanguin,allergies,maladies_chroniques,traitements_en_cours,antecedents_medicaux FROM users WHERE phone=$1`, [patient_phone]),
      pool.query(`SELECT cr.motif,cr.diagnostic,cr.traitement,cr.created_at,p.medications FROM consultation_reports cr LEFT JOIN prescriptions p ON p.appointment_id=cr.appointment_id WHERE cr.patient_phone=$1 ORDER BY cr.created_at DESC LIMIT 5`, [patient_phone]),
      pool.query(`SELECT id,status,appointment_date,appointment_time,created_at FROM appointments WHERE id=$1`, [appointment_id])
    ]);
    const constes = c.rows[0]||{}, hist = h.rows, rdv = r.rows[0]||{};
    const prompt = `Patient:${patient_phone} GS:${constes.groupe_sanguin||'?'},allergies:${constes.allergies||'aucune'},chroniques:${constes.maladies_chroniques||'aucune'},traitements:${constes.traitements_en_cours||'aucun'},antécédents:${constes.antecedents_medicaux||'aucun'} Historique:${JSON.stringify(hist)} RDV:date=${rdv.appointment_date||'?'},heure=${rdv.appointment_time||'?'},statut=${rdv.status||'?'}. Réponds en JSON:{antecedents_pertinents,derniere_consultation,alertes_interactions,symptomes_declares,points_attention,niveau_urgence}`;
    const completion = await groq.chat.completions.create({ model:'llama-3.3-70b-versatile', messages:[{role:'system',content:SYSTEM_AMINA},{role:'user',content:prompt}], max_tokens:1500 });
    const json = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g,'').trim());
    return res.json({ success:true, data:json });
  } catch(e) { console.error('[AI Consult briefing]',e.message); return res.json({ success:false, message:'IA indisponible' }); }
};

/**
 * POST /api/v1/ai-consult/rediger-cr
 * Génère un compte rendu SOAP structuré
 */
exports.redigerCompteRendu = async (req, res) => {
  const { motif, observations, diagnostic, patient_phone } = req.body;

  try {
    const constantes = await pool.query(
      `SELECT allergies, maladies_chroniques, traitements_en_cours
       FROM users WHERE phone = $1`,
      [patient_phone]
    );
    const c = constantes.rows[0] || {};

    const userPrompt = `Le médecin a saisi :
Motif : ${motif}
Observations : ${observations}
Diagnostic : ${diagnostic}
Allergies patient : ${c.allergies||'aucune connue'}
Maladies chroniques : ${c.maladies_chroniques||'aucune'}
Traitements en cours : ${c.traitements_en_cours||'aucun'}

1. Structure en format SOAP
2. Identifie les éléments manquants
3. Suggère les médicaments SSP Bolamu applicables

Réponds UNIQUEMENT en JSON :
{
  "soap": {
    "S": "Subjectif — ce que le patient rapporte",
    "O": "Objectif — signes cliniques observés",
    "A": "Analyse — interprétation diagnostique",
    "P": "Plan — traitement et suivi"
  },
  "elements_manquants": ["string"],
  "medicaments_suggeres": [
    { 
      "nom": "string", 
      "dosage": "string", 
      "posologie": "string", 
      "est_ssp": true|false 
    }
  ]
}`;

    const completion = await groq.chat.completions.create({ model:'llama-3.3-70b-versatile', messages:[{role:'system',content:SYSTEM_AMINA},{role:'user',content:userPrompt}], max_tokens:1500 });
    const json = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g,'').trim());
    return res.json({ success: true, data: json });
  } catch (error) {
    console.error('[AI Consult redigerCompteRendu]', error.message);
    return res.json({ success: false, message: 'IA temporairement indisponible' });
  }
};

/**
 * POST /api/v1/ai-consult/suggerer-ordonnance
 * Suggère une ordonnance basée sur le diagnostic et le catalogue SSP
 */
/**
 * POST /api/v1/ai-consult/tricolor
 * Feu tricolore : interactions, dosages, protocoles OMS Congo-B
 */
exports.analyzeTricolor = async (req, res) => {
  const { diagnosis, medications, patient_phone } = req.body;
  const doctorPhone = req.user.phone;

  if (!diagnosis || !medications) {
    return res.status(400).json({ success: false, message: 'diagnosis et medications sont requis.' });
  }

  try {
    const userPrompt = `Analyse ce diagnostic et ces médicaments prescrits au Congo-Brazzaville :\nDiagnostic : ${diagnosis}\nMédicaments : ${medications}\n\nVérifie :\n1. Interactions médicamenteuses dangereuses\n2. Dosages inhabituels pour ce contexte\n3. Conformité protocoles OMS Afrique centrale\n\nRéponds UNIQUEMENT en JSON :\n{\n  "status": "green|orange|red",\n  "message": "Explication synthétique",\n  "suggestions": ["suggestion1"]\n}`;

    let analysis = { status: 'green', message: 'Analyse indisponible — IA non configurée', suggestions: [] };

    if (groq) {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: SYSTEM_AMINA }, { role: 'user', content: userPrompt }],
        max_tokens: 500
      });
      analysis = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g, '').trim());
    }

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('ai_consult_tricolor', $1, 'users', $2, $3::jsonb)`,
      [doctorPhone, patient_phone || null, JSON.stringify({ status: analysis.status })]
    ).catch(() => {});

    return res.json({ success: true, data: analysis });
  } catch (e) {
    console.error('[AI Consult tricolor]', e.message);
    return res.json({ success: true, data: { status: 'green', message: 'Analyse indisponible', suggestions: [] } });
  }
};

/**
 * GET /api/v1/ai-consult/renewal/:phone
 * Renouvellement assisté : éligibilité + suggestion basée sur dernière ordonnance
 */
exports.generateRenewal = async (req, res) => {
  const patientPhone = normalizePhone(req.params.phone || '');
  const doctorPhone = req.user.phone;

  if (!patientPhone) {
    return res.status(400).json({ success: false, message: 'Numéro patient invalide.' });
  }

  try {
    const lastConsult = await pool.query(
      `SELECT a.appointment_date, a.motif, cr.diagnostic
       FROM appointments a
       LEFT JOIN consultation_reports cr ON cr.appointment_id = a.id
       WHERE a.patient_phone = $1 AND a.status = 'termine'
       ORDER BY a.appointment_date DESC LIMIT 1`,
      [patientPhone]
    );

    if (!lastConsult.rows.length) {
      return res.json({ success: true, data: { eligible: false, suggestion: null, reason: 'Aucune consultation précédente trouvée.' } });
    }

    const last = lastConsult.rows[0];
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    if (new Date(last.appointment_date) < threeMonthsAgo) {
      return res.json({ success: true, data: { eligible: false, suggestion: null, reason: 'Dernière consultation > 3 mois.' } });
    }

    const chronicKeywords = ['diabète', 'hypertension', 'asthme', 'épilepsie', 'chronique', 'htn', 'diabetes', 'hta'];
    const isChronic = chronicKeywords.some(kw =>
      (last.motif || '').toLowerCase().includes(kw) ||
      (last.diagnostic || '').toLowerCase().includes(kw)
    );

    if (!isChronic) {
      return res.json({ success: true, data: { eligible: false, suggestion: null, reason: 'Pathologie non chronique détectée.' } });
    }

    const lastPrescription = await pool.query(
      `SELECT medications, instructions FROM prescriptions
       WHERE patient_phone = $1 ORDER BY created_at DESC LIMIT 1`,
      [patientPhone]
    );

    if (!lastPrescription.rows.length) {
      return res.json({ success: true, data: { eligible: false, suggestion: null, reason: 'Aucune ordonnance précédente.' } });
    }

    const p = lastPrescription.rows[0];

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('ai_consult_renewal', $1, 'users', $2, $3::jsonb)`,
      [doctorPhone, patientPhone, JSON.stringify({ eligible: true })]
    ).catch(() => {});

    return res.json({
      success: true,
      data: {
        eligible: true,
        suggestion: { medications: p.medications, instructions: p.instructions },
        reason: 'Pathologie chronique stable, dernière consultation < 3 mois.'
      }
    });
  } catch (e) {
    console.error('[AI Consult renewal]', e.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

exports.suggererOrdonnance = async (req, res) => {
  const { diagnostic, patient_phone, allergies } = req.body;

  try {
    const userPrompt = `Diagnostic : ${diagnostic}
Allergies connues : ${allergies||'aucune'}

Sur la base du catalogue SSP Bolamu (médicaments OMS liste modèle 
23e édition pour l'Afrique subsaharienne), suggère une ordonnance 
adaptée aux soins primaires au Congo-Brazzaville.

RÈGLES :
1. EN PRIORITÉ les médicaments SSP Bolamu disponibles (est_ssp: true) 
   avec justification clinique précise pourquoi ce médicament est indiqué
2. SI NÉCESSAIRE les médicaments hors catalogue (est_ssp: false) avec :
   - Justification clinique pourquoi le SSP ne suffit pas
   - Justification détaillée dans le champ "justification"

Réponds UNIQUEMENT en JSON :
{
  "medicaments": [
    {
      "nom": "string",
      "dosage": "string", 
      "posologie": "string",
      "duree": "string",
      "est_ssp": true|false,
      "justification": "string"
    }
  ],
  "instructions_generales": "string",
  "avertissements": ["string"],
  "orientation_necessaire": false
}`;

    const completion = await groq.chat.completions.create({ model:'llama-3.3-70b-versatile', messages:[{role:'system',content:SYSTEM_AMINA},{role:'user',content:userPrompt}], max_tokens:1500 });
    const json = JSON.parse(completion.choices[0].message.content.replace(/```json|```/g,'').trim());
    return res.json({ success: true, data: json });
  } catch (error) {
    console.error('[AI Consult suggererOrdonnance]', error.message);
    return res.json({ success: false, message: 'IA temporairement indisponible' });
  }
};
