// ============================================================
// BOLAMU — AI Consult Controller (Amina)
// Moteur IA pour médecins via Google Gemini API
// ============================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const pool = require('../config/db');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
      pool.query(`SELECT groupe_sanguin,allergies,maladies_chroniques,traitements_en_cours,antecedents_medicaux FROM patient_health_records WHERE patient_phone=$1`, [patient_phone]),
      pool.query(`SELECT cr.motif,cr.diagnostic,cr.traitement,cr.created_at,p.medications FROM consultation_reports cr LEFT JOIN prescriptions p ON p.appointment_id=cr.appointment_id WHERE cr.patient_phone=$1 ORDER BY cr.created_at DESC LIMIT 5`, [patient_phone]),
      pool.query(`SELECT id,status,appointment_date,appointment_time,created_at FROM appointments WHERE id=$1`, [appointment_id])
    ]);
    const constes = c.rows[0]||{}, hist = h.rows, rdv = r.rows[0]||{};
    const prompt = `Patient:${patient_phone} GS:${constes.groupe_sanguin||'?'},allergies:${constes.allergies||'aucune'},chroniques:${constes.maladies_chroniques||'aucune'},traitements:${constes.traitements_en_cours||'aucun'},antécédents:${constes.antecedents_medicaux||'aucun'} Historique:${JSON.stringify(hist)} RDV:date=${rdv.appointment_date||'?'},heure=${rdv.appointment_time||'?'},statut=${rdv.status||'?'}. Réponds en JSON:{antecedents_pertinents,derniere_consultation,alertes_interactions,symptomes_declares,points_attention,niveau_urgence}`;
    const model = genAI.getGenerativeModel({ model:'gemini-1.5-flash' });
    const result = await model.generateContent(SYSTEM_AMINA+'\n\n'+prompt);
    const json = JSON.parse(result.response.text().replace(/```json|```/g,'').trim());
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
       FROM patient_health_records WHERE patient_phone = $1`,
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

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(SYSTEM_AMINA + '\n\n' + userPrompt);
    const text = result.response.text();
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());
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
exports.suggererOrdonnance = async (req, res) => {
  const { diagnostic, patient_phone, allergies } = req.body;

  try {
    const userPrompt = `Diagnostic : ${diagnostic}
Allergies connues : ${allergies||'aucune'}

Sur la base du catalogue SSP Bolamu (médicaments OMS liste modèle 
23e édition pour l'Afrique subsaharienne), suggère une ordonnance 
adaptée aux soins primaires au Congo-Brazzaville.

Réponds UNIQUEMENT en JSON :
{
  "medicaments": [
    {
      "nom": "string",
      "dosage": "string", 
      "posologie": "string",
      "duree": "string",
      "est_ssp": true|false
    }
  ],
  "instructions_generales": "string",
  "avertissements": ["string"],
  "orientation_necessaire": false
}`;

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(SYSTEM_AMINA + '\n\n' + userPrompt);
    const text = result.response.text();
    const json = JSON.parse(text.replace(/```json|```/g, '').trim());
    return res.json({ success: true, data: json });
  } catch (error) {
    console.error('[AI Consult suggererOrdonnance]', error.message);
    return res.json({ success: false, message: 'IA temporairement indisponible' });
  }
};
