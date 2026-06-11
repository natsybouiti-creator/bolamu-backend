// ============================================================
// BOLAMU — Service WhatsApp Business API (Sprint 7)
// ============================================================
const pool = require('../config/db');
const logger = require('../config/logger');

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
    }
};

// Envoyer message WhatsApp
async function sendMessage(phone, templateName, parameters = {}) {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
        logger.warn('[WhatsApp] WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID non configuré');
        return { success: false, error: 'Configuration manquante' };
    }

    // Formater le numéro pour WhatsApp (242 au lieu de 2420)
    const whatsappPhone = phone.replace('+', '').replace(/^2420/, '242');

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
                        const phone = message.from;
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

    // Formater le numéro en +242XXXXXXXXX
    let formattedPhone = to;
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
    }
    // S'assurer que le format est +242XXXXXXXXX (12 chiffres après le +)
    formattedPhone = formattedPhone.replace('+2420', '+242');

    if (isDevelopment) {
        logger.info('[WhatsApp] Template simulé (développement)', { to: formattedPhone, templateName, params });
        console.log(`[WhatsApp SIMULÉ] Vers: ${formattedPhone} | Template: ${templateName} | Params: ${JSON.stringify(params)}`);
        return true;
    }

    try {
        const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        
        const body = {
            messaging_product: 'whatsapp',
            to: formattedPhone.replace('+', ''),
            type: 'template',
            template: {
                name: templateName,
                language: { code: 'fr' },
                components: [
                    {
                        type: 'body',
                        parameters: params.map(param => ({
                            type: 'text',
                            text: param
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

module.exports = {
    sendMessage,
    sendWhatsAppTemplate,
    handleWebhook,
    verifyWebhook,
    WHATSAPP_TEMPLATES
};
