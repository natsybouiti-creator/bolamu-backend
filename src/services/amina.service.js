// ============================================================
// BOLAMU — Service AI Consult Amina (Sprint 9)
// ============================================================
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../config/db');
const logger = require('../config/logger');

// System prompt Amina
const SYSTEM_PROMPT_AMINA = `Tu es Amina, l'assistante santé de Bolamu, la plateforme de santé du Congo-Brazzaville. Tu es bienveillante, professionnelle et tu parles français. Tu peux aussi utiliser quelques mots en Lingala pour mettre à l'aise les patients (mbote = bonjour, malamu = bien, tosanola = au revoir).

TON RÔLE :
- Aider les patients à décrire leurs symptômes avant un RDV
- Orienter vers le bon type de soin (urgences, médecin généraliste, spécialiste)
- Rappeler les rendez-vous et suivis
- Aider au renouvellement d'ordonnances simples

TU NE DOIS JAMAIS :
- Poser un diagnostic médical
- Prescrire des médicaments
- Remplacer l'avis d'un médecin
- Donner des informations sur des pathologies graves sans rediriger vers un professionnel

À CHAQUE RÉPONSE :
- Sois concise (max 3 phrases)
- Si symptômes graves détectés : rediriger IMMÉDIATEMENT vers les urgences ou un médecin
- Termine toujours par une question ouverte pour mieux cerner le besoin du patient

DISCLAIMER OBLIGATOIRE (ajouter en fin de session) :
'Je suis une assistante IA et non un médecin. Pour tout problème de santé sérieux, consultez toujours un professionnel de santé.'`;

// Disclaimer médical obligatoire
const DISCLAIMER_MEDICAL = 'Je suis une assistante IA et non un médecin. Pour tout problème de santé sérieux, consultez toujours un professionnel de santé.';

// Initialiser client Anthropic
let anthropic = null;

function initAnthropic() {
    if (!process.env.ANTHROPIC_API_KEY) {
        logger.warn('[Amina] ANTHROPIC_API_KEY non configuré - mode simulation');
        return null;
    }
    anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });
    logger.info('[Amina] Client Anthropic initialisé');
    return anthropic;
}

// Démarrer session Amina
async function startSession(patient_phone, session_type = 'symptomes') {
    try {
        // INSERT ai_consult_sessions
        const result = await pool.query(`
            INSERT INTO ai_consult_sessions (patient_phone, session_type, messages, created_at, updated_at)
            VALUES ($1, $2, '[]', NOW(), NOW())
            RETURNING id
        `, [patient_phone, session_type]);

        const session_id = result.rows[0].id;

        // Message d'accueil Amina
        let message_accueil = '';
        if (session_type === 'symptomes') {
            message_accueil = 'Mbote ! Je suis Amina, votre assistante santé Bolamu. Comment puis-je vous aider aujourd\'hui ?';
        } else if (session_type === 'renouvellement') {
            message_accueil = 'Mbote ! Je suis Amina. Je peux vous aider avec le renouvellement d\'ordonnance. Quelle prescription souhaitez-vous renouveler ?';
        } else {
            message_accueil = 'Mbote ! Je suis Amina, votre assistante santé Bolamu. Comment puis-je vous aider ?';
        }

        logger.info('[Amina] Session démarrée', { session_id, patient_phone, session_type });

        return {
            success: true,
            session_id,
            message_accueil
        };
    } catch (error) {
        logger.error('[Amina] Erreur startSession:', error.message);
        return { success: false, error: error.message };
    }
}

// Envoyer message à Amina
async function sendMessage(session_id, patient_phone, user_message) {
    try {
        // Récupérer historique messages de la session
        const sessionResult = await pool.query(`
            SELECT messages, tokens_utilises FROM ai_consult_sessions WHERE id = $1
        `, [session_id]);

        if (sessionResult.rows.length === 0) {
            return { success: false, error: 'Session introuvable' };
        }

        const session = sessionResult.rows[0];
        const messages = JSON.parse(session.messages || '[]');
        const tokens_utilises = session.tokens_utilises || 0;

        // Vérifier limite tokens
        if (tokens_utilises >= 2000) {
            logger.warn('[Amina] Limite tokens atteinte', { session_id, tokens_utilises });
            return {
                success: false,
                error: 'Limite de tokens atteinte pour cette session',
                message: 'Désolé, cette session a atteint sa limite. Veuillez démarrer une nouvelle session.'
            };
        }

        // Ajouter message utilisateur à l'historique
        messages.push({
            role: 'user',
            content: user_message,
            timestamp: new Date().toISOString()
        });

        // Appel API Anthropic (si configuré)
        let message_amina = '';
        let rdv_suggere = false;
        let renouvellement_suggere = false;
        let tokens_used = 0;

        if (anthropic) {
            try {
                const response = await anthropic.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 300,
                    system: SYSTEM_PROMPT_AMINA,
                    messages: messages.map(m => ({
                        role: m.role,
                        content: m.content
                    }))
                });

                message_amina = response.content[0].text;
                tokens_used = response.usage.input_tokens + response.usage.output_tokens;

                // Analyser réponse pour détecter suggestions
                const response_lower = message_amina.toLowerCase();
                if (response_lower.includes('rdv') || response_lower.includes('rendez-vous')) {
                    rdv_suggere = true;
                }
                if (response_lower.includes('renouvel') || response_lower.includes('ordonnance')) {
                    renouvellement_suggere = true;
                }

                // Ajouter disclaimer médical
                message_amina += '\n\n' + DISCLAIMER_MEDICAL;

            } catch (apiError) {
                logger.error('[Amina] Erreur API Anthropic:', apiError.message);
                // Fallback : message générique
                message_amina = 'Désolé, je rencontre des difficultés techniques. Veuillez réessayer ou contacter le support.';
            }
        } else {
            // Mode simulation (sans API key)
            message_amina = 'Mbote ! Je suis Amina, votre assistante santé. En mode simulation, je ne peux pas répondre pleinement. Configurez ANTHROPIC_API_KEY pour activer mes capacités complètes.';
            message_amina += '\n\n' + DISCLAIMER_MEDICAL;
        }

        // Ajouter réponse Amina à l'historique
        messages.push({
            role: 'assistant',
            content: message_amina,
            timestamp: new Date().toISOString()
        });

        // UPDATE session
        await pool.query(`
            UPDATE ai_consult_sessions
            SET messages = $1, tokens_utilises = $2, updated_at = NOW()
            WHERE id = $3
        `, [JSON.stringify(messages), tokens_utilises + tokens_used, session_id]);

        logger.info('[Amina] Message envoyé', { session_id, tokens_used, rdv_suggere, renouvellement_suggere });

        return {
            success: true,
            message_amina,
            rdv_suggere,
            renouvellement_suggere,
            tokens_utilises: tokens_utilises + tokens_used
        };
    } catch (error) {
        logger.error('[Amina] Erreur sendMessage:', error.message);
        return { success: false, error: error.message };
    }
}

// Analyser pré-RDV
async function analyserPreRDV(pre_rdv_id) {
    try {
        // Récupérer formulaire pré-RDV
        const result = await pool.query(`
            SELECT symptomes, symptomes_libres, duree_symptomes, intensite, antecedents, medicaments_actuels, allergies
            FROM pre_rdv_formulaires WHERE id = $1
        `, [pre_rdv_id]);

        if (result.rows.length === 0) {
            return { success: false, error: 'Formulaire introuvable' };
        }

        const formulaire = result.rows[0];

        // Construire contexte pour Amina
        const contexte = `
Symptômes : ${formulaire.symptomes.join(', ') || formulaire.symptomes_libres || 'Non spécifié'}
Durée : ${formulaire.duree_symptomes || 'Non spécifié'}
Intensité : ${formulaire.intensite || 'Non spécifié'}/10
Antécédents : ${formulaire.antecedents || 'Non spécifié'}
Médicaments actuels : ${formulaire.medicaments_actuels || 'Non spécifié'}
Allergies : ${formulaire.allergies || 'Non spécifié'}
`;

        // Appel Amina pour analyse
        let analyse_resumee = '';
        let questions_suggerees = [];

        if (anthropic) {
            try {
                const response = await anthropic.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 400,
                    system: SYSTEM_PROMPT_AMINA,
                    messages: [
                        {
                            role: 'user',
                            content: `Analyse ce formulaire pré-RDV et fournis : 1) Un résumé des symptômes (2 phrases max), 2) 3 questions pertinentes à poser au patient avant la consultation.\n\n${contexte}`
                        }
                    ]
                });

                const response_text = response.content[0].text;
                analyse_resumee = response_text;
                
                // Extraire questions (simplifié)
                questions_suggerees = response_text.split('\n').filter(line => line.includes('?')).slice(0, 3);

            } catch (apiError) {
                logger.error('[Amina] Erreur API Anthropic analyse:', apiError.message);
                analyse_resumee = 'Analyse non disponible en mode simulation';
                questions_suggerees = ['Quand les symptômes ont-ils commencé ?', 'Y a-t-il des antécédents médicaux ?', 'Prenez-vous des médicaments ?'];
            }
        } else {
            analyse_resumee = 'Analyse non disponible en mode simulation';
            questions_suggerees = ['Quand les symptômes ont-ils commencé ?', 'Y a-t-il des antécédents médicaux ?', 'Prenez-vous des médicaments ?'];
        }

        // UPDATE pre_rdv_formulaires
        await pool.query(`
            UPDATE pre_rdv_formulaires
            SET ia_analyse = $1, ia_questions_suggerees = $2
            WHERE id = $3
        `, [analyse_resumee, questions_suggerees, pre_rdv_id]);

        logger.info('[Amina] Analyse pré-RDV terminée', { pre_rdv_id });

        return {
            success: true,
            analyse_resumee,
            questions_suggerees
        };
    } catch (error) {
        logger.error('[Amina] Erreur analyserPreRDV:', error.message);
        return { success: false, error: error.message };
    }
}

// Récupérer session
async function getSession(session_id, patient_phone) {
    try {
        const result = await pool.query(`
            SELECT id, patient_phone, session_type, messages, triage_final, recommandation_finale, 
                   rdv_suggere, renouvellement_suggere, tokens_utilises, created_at, updated_at
            FROM ai_consult_sessions
            WHERE id = $1 AND patient_phone = $2
        `, [session_id, patient_phone]);

        if (result.rows.length === 0) {
            return { success: false, error: 'Session introuvable' };
        }

        return { success: true, data: result.rows[0] };
    } catch (error) {
        logger.error('[Amina] Erreur getSession:', error.message);
        return { success: false, error: error.message };
    }
}

// Initialiser au démarrage
initAnthropic();

module.exports = {
    startSession,
    sendMessage,
    analyserPreRDV,
    getSession
};
