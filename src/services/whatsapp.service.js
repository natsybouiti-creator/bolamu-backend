// ============================================================
// BOLAMU — Service WhatsApp Business API (Sprint 7)
// ============================================================
const pool = require('../config/db');
const logger = require('../config/logger');
const { normalizePhone } = require('../utils/phone');

// Configuration depuis process.env uniquement
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Templates WhatsApp
const WHATSAPP_TEMPLATES = {
    rdv_confirmation: {
        name: 'rdv_confirmation',
        language: 'fr'
    },
    paiement_confirme: {
        name: 'paiement_confirme',
        language: 'fr'
    },
    rappel_rdv: {
        name: 'rappel_rdv',
        language: 'fr'
    },
    abonnement_expire: {
        name: 'abonnement_expire',
        language: 'fr'
    },
    bolamu_magic_link: {
        name: 'bolamu_magic_link',
        category: 'UTILITY',
        language: 'fr',
        description: 'Lien de première connexion automatique',
        params: ['nom_patient', 'lien_connexion'],
        text: 'Bonjour {{1}}, votre compte Bolamu est prêt. Cliquez ici pour vous connecter automatiquement : {{2}} (lien valable 72h)'
    },
    bolamu_code_acces: {
        name: 'bolamu_code_acces',
        category: 'AUTHENTICATION',
        language: 'fr',
        description: 'Envoi mot de passe / code d\'accès (format Meta imposé + bouton copier)',
        params: ['code']
    },
    bolamu_bienvenue_patient_v4: {
        name: 'bolamu_bienvenue_patient_v4',
        category: 'UTILITY',
        language: 'fr',
        description: 'Bienvenue patient (sans credentials)',
        params: ['nom']
    },
    bolamu_bienvenue_medecin_v4: {
        name: 'bolamu_bienvenue_medecin_v4',
        category: 'UTILITY',
        language: 'fr',
        description: 'Bienvenue médecin (sans credentials)',
        params: ['nom']
    },
    bolamu_bienvenue_pharmacie_v3: {
        name: 'bolamu_bienvenue_pharmacie_v3',
        category: 'UTILITY',
        language: 'fr',
        description: 'Bienvenue pharmacie (sans credentials)',
        params: ['nom']
    },
    bolamu_bienvenue_labo_v4: {
        name: 'bolamu_bienvenue_labo_v4',
        category: 'UTILITY',
        language: 'fr',
        description: 'Bienvenue laboratoire (sans credentials)',
        params: ['nom']
    },
    bolamu_secretaire_bienvenue_v4: {
        name: 'bolamu_secretaire_bienvenue_v4',
        category: 'UTILITY',
        language: 'fr',
        description: 'Bienvenue secrétaire (sans credentials)',
        params: ['nom']
    },
    bolamu_rdv_confirme: {
        name: 'bolamu_rdv_confirme',
        category: 'UTILITY',
        language: 'fr',
        description: 'Confirmation RDV patient/médecin',
        params: ['nom_patient', 'date_rdv', 'heure_rdv', 'nom_medecin', 'adresse_etablissement', 'code_session']
    },
    // Sprint 6A : Nouveaux templates événements et Zora
    rappel_evenement: {
        name: 'rappel_evenement',
        category: 'UTILITY',
        language: 'fr',
        description: 'Rappel événement Elonga 24h avant',
        params: ['prenom', 'titre', 'heure', 'lieu']
    },
    confirmation_checkin: {
        name: 'confirmation_checkin',
        category: 'UTILITY',
        language: 'fr',
        description: 'Confirmation check-in événement',
        params: ['titre', 'points', 'solde']
    },
    gain_zora_consultation: {
        name: 'gain_zora_consultation',
        category: 'UTILITY',
        language: 'fr',
        description: 'Gain Zora après consultation',
        params: ['medecin', 'points', 'solde']
    },
    voucher_expirant: {
        name: 'voucher_expirant',
        category: 'UTILITY',
        language: 'fr',
        description: 'Rappel voucher expirant 48h avant',
        params: ['titre', 'partenaire', 'date']
    },
    rappel_rdv_24h: {
        name: 'rappel_rdv_24h',
        category: 'UTILITY',
        language: 'fr',
        description: 'Rappel RDV 24h avant',
        params: ['heure', 'medecin', 'adresse']
    },
    gain_jeu_zora: {
        name: 'gain_jeu_zora',
        category: 'UTILITY',
        language: 'fr',
        description: 'Gain Zora après jeu',
        params: ['points', 'jeu', 'solde']
    }
};

// Templates AUTHENTICATION : nécessitent un composant bouton copy_code à l'envoi
const AUTH_TEMPLATES = ['bolamu_code_acces'];

// Envoyer message WhatsApp
async function sendMessage(phone, templateName, parameters = {}) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        logger.warn('[WhatsApp] WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID non configuré');
        return { success: false, error: 'Configuration manquante' };
    }

    const whatsappPhone = normalizePhone(phone || '').replace('+', '');

    const template = WHATSAPP_TEMPLATES[templateName];
    if (!template) {
        logger.error('[WhatsApp] Template inconnu:', templateName);
        return { success: false, error: 'Template inconnu' };
    }

    if (isDevelopment) {
        // En développement : logger sans envoyer
        logger.info('[WhatsApp] Message simulé (développement)', { phone, templateName, parameters });
        console.log(`[WhatsApp SIMULÉ] Vers: ${whatsappPhone} | Template: ${templateName} | Params: ${JSON.stringify(parameters)}`);
        return { success: true, simulated: true };
    }

    try {
        const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        const body = {
            messaging_product: 'whatsapp',
            to: whatsappPhone,
            type: 'template',
            template: {
                name: template.name,
                language: { code: template.language },
                components: [
                    {
                        type: 'body',
                        parameters: Object.keys(parameters).map(key => ({
                            type: 'text',
                            text: parameters[key]
                        }))
                    }
                ]
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            logger.error('[WhatsApp] Erreur envoi message:', data);
            return { success: false, error: data };
        }

        logger.info('[WhatsApp] Message envoyé avec succès', { phone, templateName });

        // INSERT dans notifications avec canal='whatsapp'
        await pool.query(`
            INSERT INTO notifications (user_phone, type, titre, message, data, canal, is_read, sent_at, created_at)
            VALUES ($1, 'whatsapp_message', $2, $3, $4, 'whatsapp', FALSE, NOW(), NOW())
        `, [phone, templateName, `WhatsApp: ${templateName}`, JSON.stringify(parameters)]);

        return { success: true, data };
    } catch (error) {
        logger.error('[WhatsApp] Erreur sendMessage:', error.message);
        // Ne jamais bloquer l'opération principale
        return { success: false, error: error.message };
    }
}

// Traiter webhook WhatsApp
async function handleWebhook(body) {
    try {
        logger.info('[WhatsApp] Webhook reçu:', JSON.stringify(body));

        // Traiter les messages entrants WhatsApp
        if (body.entry && body.entry[0] && body.entry[0].changes) {
            for (const change of body.entry[0].changes) {
                if (change.value && change.value.messages) {
                    for (const message of change.value.messages) {
                        const rawFrom = message.from || '';
                        const phone = normalizePhone(rawFrom.startsWith('+') ? rawFrom : '+' + rawFrom);
                        const text = message.text ? message.text.body : '';

                        // Logger dans notifications
                        await pool.query(`
                            INSERT INTO notifications (user_phone, type, titre, message, data, canal, is_read, created_at)
                            VALUES ($1, 'whatsapp_message', 'Message WhatsApp reçu', $2, $3, 'whatsapp', FALSE, NOW())
                        `, [phone, text, JSON.stringify(message)]);
                    }
                }
            }
        }

        return { success: true };
    } catch (error) {
        logger.error('[WhatsApp] Erreur handleWebhook:', error.message);
        return { success: false, error: error.message };
    }
}

// Envoyer template WhatsApp avec tableau de params
async function sendWhatsAppTemplate(to, templateName, params = []) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        logger.warn('[WhatsApp] WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID non configuré');
        return false;
    }

    const formattedPhone = normalizePhone(to || '');

    if (isDevelopment) {
        logger.info('[WhatsApp] Template simulé (développement)', { to: formattedPhone, templateName, params });
        console.log(`[WhatsApp SIMULÉ] Vers: ${formattedPhone} | Template: ${templateName} | Params: ${JSON.stringify(params)}`);
        return true;
    }

    try {
        const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        const components = [
            {
                type: 'body',
                parameters: params.map(param => ({
                    type: 'text',
                    text: param
                }))
            }
        ];

        // Format AUTHENTICATION : le bouton copy_code doit recevoir le code en paramètre
        if (AUTH_TEMPLATES.includes(templateName)) {
            components.push({
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: params[0] }]
            });
        }

        const body = {
            messaging_product: 'whatsapp',
            to: formattedPhone.replace('+', ''),
            type: 'template',
            template: {
                name: templateName,
                language: { code: 'fr' },
                components
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            logger.error('[WhatsApp] Erreur envoi template:', data);
            return false;
        }

        logger.info('[WhatsApp] Template envoyé avec succès', { to: formattedPhone, templateName });

        // INSERT dans notifications avec canal='whatsapp'
        await pool.query(`
            INSERT INTO notifications (user_phone, type, titre, message, data, canal, is_read, sent_at, created_at)
            VALUES ($1, 'whatsapp_template', $2, $3, $4, 'whatsapp', FALSE, NOW(), NOW())
        `, [to, templateName, `WhatsApp Template: ${templateName}`, JSON.stringify(params)]);

        return true;
    } catch (error) {
        logger.error('[WhatsApp] Erreur sendWhatsAppTemplate:', error.message);
        return false;
    }
}

// Vérifier webhook WhatsApp (GET pour verification token)
function verifyWebhook(mode, token, challenge) {
    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    if (!VERIFY_TOKEN) {
        logger.error('[WhatsApp] WHATSAPP_VERIFY_TOKEN non configuré');
        return null;
    }

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        logger.info('[WhatsApp] Webhook vérifié avec succès');
        return challenge;
    }

    logger.error('[WhatsApp] Vérification webhook échouée');
    return null;
}

/**
 * Notification d'inscription à un événement
 * @param {string} patient_phone - Numéro du patient
 * @param {Object} event - Objet événement (title, starts_at, location_name)
 * @param {string} session_code - Code de session
 * @returns {Promise<boolean>} Succès de l'envoi
 */
async function notifyEventRegistration(patient_phone, event, session_code) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        logger.warn('[WhatsApp] WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID non configuré');
        return false;
    }

    const formattedPhone = normalizePhone(patient_phone);

    // Formater la date
    const eventDate = new Date(event.starts_at);
    const dateStr = eventDate.toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
    });

    // Message personnalisé pour inscription événement
    const message = `Inscription confirmée ✅\nÉvénement : ${event.title}\nDate : ${dateStr}\nLieu : ${event.location_name}\nVotre code de session : ${session_code}\nPrésentez ce code à l'animateur le jour J.`;

    if (isDevelopment) {
        logger.info('[WhatsApp] Notification inscription simulée (développement)', { 
            to: formattedPhone, 
            event: event.title, 
            session_code 
        });
        console.log(`[WhatsApp SIMULÉ] Vers: ${formattedPhone} | Inscription: ${event.title} | Code: ${session_code}`);
        return true;
    }

    try {
        const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        const body = {
            messaging_product: 'whatsapp',
            to: formattedPhone.replace('+', ''),
            type: 'text',
            text: { body: message }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            logger.error('[WhatsApp] Erreur notification inscription:', data);
            return false;
        }

        logger.info('[WhatsApp] Notification inscription envoyée avec succès', { 
            to: formattedPhone, 
            event: event.title 
        });

        // INSERT dans notifications avec canal='whatsapp'
        await pool.query(`
            INSERT INTO notifications (user_phone, type, titre, message, data, canal, is_read, sent_at, created_at)
            VALUES ($1, 'event_registration', $2, $3, $4, 'whatsapp', FALSE, NOW(), NOW())
        `, [patient_phone, `Inscription: ${event.title}`, message, JSON.stringify({ event_id: event.id, session_code })]);

        return true;
    } catch (error) {
        logger.error('[WhatsApp] Erreur notifyEventRegistration:', error.message);
        return false;
    }
}

module.exports = {
    sendMessage,
    sendWhatsAppTemplate,
    handleWebhook,
    verifyWebhook,
    notifyEventRegistration,
    WHATSAPP_TEMPLATES
};
