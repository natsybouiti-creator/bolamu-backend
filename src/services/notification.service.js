// ============================================================
// BOLAMU — Service Notification Unifié (Sprint 7)
// ============================================================
const pool = require('../config/db');
const logger = require('../config/logger');
const { sendToUser } = require('./push.service');
const { sendMessage } = require('./whatsapp.service');
const { sendBolamuSms } = require('./sms.service');

// Fonction centrale de notification
async function notify(user_phone, type, data = {}) {
    try {
        // Déterminer le titre et le message selon le type
        const { titre, message } = getNotificationContent(type, data);

        // Toujours insérer dans table notifications
        await pool.query(`
            INSERT INTO notifications (user_phone, type, titre, message, data, canal, is_read, created_at)
            VALUES ($1, $2, $3, $4, $5, 'pending', FALSE, NOW())
        `, [user_phone, type, titre, message, JSON.stringify(data)]);

        // Déterminer les canaux selon les préférences et disponibilité
        const hasWhatsApp = process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_ID;
        const hasPush = await hasActivePushSubscription(user_phone);
        const hasSMS = true; // Africa's Talking toujours disponible

        let sentChannels = [];

        // Canal prioritaire : WhatsApp si disponible
        if (hasWhatsApp) {
            try {
                const templateName = getWhatsAppTemplate(type);
                const parameters = getWhatsAppParameters(type, data);
                await sendMessage(user_phone, templateName, parameters);
                sentChannels.push('whatsapp');
            } catch (error) {
                logger.error('[Notification] Erreur WhatsApp:', error.message);
            }
        }

        // Canal secondaire : Push si subscription active
        if (hasPush) {
            try {
                await sendToUser(user_phone, { titre, message, type, data });
                sentChannels.push('push');
            } catch (error) {
                logger.error('[Notification] Erreur Push:', error.message);
            }
        }

        // Canal fallback : SMS (toujours disponible)
        if (sentChannels.length === 0 || hasSMS) {
            try {
                await sendBolamuSms(user_phone, message);
                sentChannels.push('sms');
            } catch (error) {
                logger.error('[Notification] Erreur SMS:', error.message);
            }
        }

        // Mettre à jour le canal utilisé dans notifications
        await pool.query(`
            UPDATE notifications 
            SET canal = $1, sent_at = NOW() 
            WHERE user_phone = $2 AND type = $3 AND sent_at IS NULL
            ORDER BY created_at DESC LIMIT 1
        `, [sentChannels[0] || 'sms', user_phone, type]);

        logger.info('[Notification] Notification envoyée', { user_phone, type, channels: sentChannels });
        return { success: true, channels: sentChannels };
    } catch (error) {
        logger.error('[Notification] Erreur notify:', error.message);
        // Ne jamais bloquer l'opération principale
        return { success: false, error: error.message };
    }
}

// Vérifier si l'utilisateur a une subscription push active
async function hasActivePushSubscription(user_phone) {
    try {
        const result = await pool.query(`
            SELECT COUNT(*) as count 
            FROM push_subscriptions 
            WHERE user_phone = $1 AND is_active = TRUE
        `, [user_phone]);
        return parseInt(result.rows[0].count) > 0;
    } catch (error) {
        logger.error('[Notification] Erreur hasActivePushSubscription:', error.message);
        return false;
    }
}

// Obtenir le contenu de la notification selon le type
function getNotificationContent(type, data) {
    const contentMap = {
        rdv_confirme: {
            titre: 'Rendez-vous confirmé',
            message: `Votre rendez-vous avec Dr ${data.doctor_name} est confirmé pour le ${data.date} à ${data.heure}.`
        },
        rdv_rappel: {
            titre: 'Rappel rendez-vous',
            message: `Rappel : RDV demain avec Dr ${data.doctor_name} à ${data.heure}.`
        },
        rdv_annule: {
            titre: 'Rendez-vous annulé',
            message: `Votre rendez-vous du ${data.date} a été annulé.`
        },
        paiement_recu: {
            titre: 'Paiement reçu',
            message: `Paiement de ${data.montant} FCFA reçu. Abonnement ${data.plan} actif.`
        },
        abonnement_expire: {
            titre: 'Abonnement expire bientôt',
            message: `Votre abonnement expire dans 3 jours. Renouvelez sur l'application.`
        },
        abonnement_renouvele: {
            titre: 'Abonnement renouvelé',
            message: `Votre abonnement ${data.plan} a été renouvelé avec succès.`
        },
        conflit_update: {
            titre: 'Conflit mis à jour',
            message: `Votre conflit a été mis à jour. Consultez l'application.`
        },
        message_recu: {
            titre: 'Message reçu',
            message: `Vous avez reçu un nouveau message.`
        },
        alerte_systeme: {
            titre: 'Alerte système',
            message: data.message || 'Une alerte système a été déclenchée.'
        },
        whatsapp_message: {
            titre: 'Message WhatsApp',
            message: data.message || 'Message WhatsApp reçu.'
        }
    };

    return contentMap[type] || { titre: 'Notification', message: 'Nouvelle notification.' };
}

// Obtenir le template WhatsApp selon le type
function getWhatsAppTemplate(type) {
    const templateMap = {
        rdv_confirme: 'rdv_confirmation',
        paiement_recu: 'paiement_confirme',
        rdv_rappel: 'rappel_rdv',
        abonnement_expire: 'abonnement_expire'
    };

    return templateMap[type] || null;
}

// Obtenir les paramètres WhatsApp selon le type
function getWhatsAppParameters(type, data) {
    const paramMap = {
        rdv_confirme: {
            nom: data.patient_name || 'Patient',
            medecin: data.doctor_name,
            date: data.date,
            heure: data.heure
        },
        paiement_confirme: {
            montant: data.montant,
            plan: data.plan,
            date: data.expires_at
        },
        rdv_rappel: {
            medecin: data.doctor_name,
            heure: data.heure,
            code: data.code || ''
        },
        abonnement_expire: {}
    };

    return paramMap[type] || {};
}

module.exports = {
    notify,
    hasActivePushSubscription
};
