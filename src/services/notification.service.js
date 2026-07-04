// ============================================================
// BOLAMU — Service Notification Unifié (Sprint 7)
// ============================================================
const pool = require('../config/db');
const logger = require('../config/logger');
const { sendToUser } = require('./push.service');
const { sendMessage } = require('./whatsapp.service');
const { sendWhatsAppTemplate } = require('./whatsapp.service');
const { sendAutoMessage } = require('./whatsapp-web.service');
const { getIo } = require('./socketService');

// ============================================================
// RÉSEAU SOCIAL — notification légère (in-app uniquement)
// Pas de cascade WhatsApp/Push/SMS : utilisé pour les interactions
// sociales à faible enjeu (like, commentaire, nouvel abonné).
// ============================================================
async function notifyLite({ user_phone, type, titre, message, link, metadata = {} }) {
    try {
        const result = await pool.query(`
            INSERT INTO notifications (user_phone, type, titre, message, link, metadata, canal, is_read, created_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, 'in_app', FALSE, NOW())
            RETURNING *
        `, [user_phone, type, titre, message || null, link || null, JSON.stringify(metadata)]);

        const io = getIo();
        if (io) {
            io.to(`user:${user_phone}`).emit('notification', result.rows[0]);
        }

        return result.rows[0];
    } catch (err) {
        logger.error('[notification.service] Erreur notifyLite:', err.message);
        return null;
    }
}

// Fonction centrale de notification
async function notify(user_phone, type, data = {}) {
    try {
        // Déterminer le titre et le message selon le type
        const { titre, message } = getNotificationContent(type, data);

        // Toujours insérer dans table notifications
        await pool.query(`
            INSERT INTO notifications (user_phone, type, titre, message, data, canal, is_read, created_at)
            VALUES ($1, $2, $3, $4, $5, NULL, FALSE, NOW())
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

        // Canal fallback : SMS uniquement si WhatsApp ET Push ont échoué
        if (sentChannels.length === 0) {
            try {
                await sendWhatsAppTemplate(user_phone, 'bolamu_notification_fallback', [message]);
                // TODO: supprimer sendBolamuSms après validation WhatsApp
                // await sendBolamuSms(user_phone, message);
                sentChannels.push('whatsapp');
            } catch (error) {
                logger.error('[Notification] Erreur SMS:', error.message);
            }
        }

        // Mettre à jour le canal utilisé dans notifications
        await pool.query(`
            UPDATE notifications
            SET canal = $1, sent_at = NOW()
            WHERE id = (
              SELECT id FROM notifications
              WHERE user_phone = $2 AND type = $3 AND sent_at IS NULL
              ORDER BY created_at DESC LIMIT 1
            )
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
            message: data.message || 'Vous avez reçu un nouveau message.'
        },
        alerte_systeme: {
            titre: 'Alerte système',
            message: data.message || 'Une alerte système a été déclenchée.'
        },
        whatsapp_message: {
            titre: 'Message WhatsApp',
            message: data.message || 'Message WhatsApp reçu.'
        },
        labo_resultats_disponibles: {
            titre: 'Résultats d\'examens disponibles',
            message: data.message || 'Vos résultats d\'examens sont disponibles. Consultez votre médecin pour l\'interprétation.'
        },
        labo_resultats_patient: {
            titre: 'Résultats labo disponibles',
            message: data.message || 'Les résultats labo de votre patient sont disponibles.'
        },
        encouragement: {
            titre: 'Encouragement reçu',
            message: (data.sender_name || 'Un membre') + ' vous a encouragé sur le classement hebdomadaire !'
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

// ============================================================
// SPRINT 3 — Notifications WhatsApp métier avec fallback wame
// ============================================================
const { buildWameLink } = require('./wame.service');
const { normalizePhone } = require('../utils/phone');

async function _saveWhatsAppNotif(recipient_phone, template_name, template_params, status, sent_at = null) {
    try {
        await pool.query(
            `INSERT INTO whatsapp_notifications
               (recipient_phone, template_name, template_params, status, sent_at)
             VALUES ($1, $2, $3::jsonb, $4, $5)`,
            [recipient_phone, template_name, JSON.stringify(template_params), status, sent_at]
        );
    } catch (err) {
        logger.error('[WA Notif] Erreur INSERT whatsapp_notifications:', err.message);
    }
}

async function notifyRdvConfirme(patient_phone, rdv_data) {
    const phone = normalizePhone(patient_phone);
    const params = [
        rdv_data.patient_name || '',
        rdv_data.date || '',
        rdv_data.heure || '',
        rdv_data.doctor_name || '',
        rdv_data.adresse || '',
        rdv_data.code || ''
    ];

    try {
        const ok = await sendAutoMessage(phone, 'bolamu_rdv_confirme', params);
        await _saveWhatsAppNotif(phone, 'bolamu_rdv_confirme', { params, rdv_data }, ok ? 'sent' : 'failed', ok ? new Date() : null);
        if (!ok) {
            buildWameLink(phone, 'rdv_confirme', {
                prenom: rdv_data.patient_name || '',
                medecin: rdv_data.doctor_name || '',
                date: rdv_data.date || '',
                heure: rdv_data.heure || '',
                clinique: rdv_data.adresse || ''
            });
        }
        return ok;
    } catch (err) {
        logger.error('[WA Notif] notifyRdvConfirme:', err.message);
        await _saveWhatsAppNotif(phone, 'bolamu_rdv_confirme', { params, rdv_data }, 'failed');
        return false;
    }
}

async function notifyEvenementInscription(patient_phone, event_data) {
    const phone = normalizePhone(patient_phone);
    const params = [
        event_data.nom_evenement || '',
        event_data.date || '',
        event_data.heure || '',
        event_data.lieu || '',
        String(event_data.zora || 0)
    ];

    try {
        const ok = await sendAutoMessage(phone, 'bolamu_event_rappel', params);
        await _saveWhatsAppNotif(phone, 'bolamu_event_rappel', { params, event_data }, ok ? 'sent' : 'failed', ok ? new Date() : null);
        return ok;
    } catch (err) {
        logger.error('[WA Notif] notifyEvenementInscription:', err.message);
        await _saveWhatsAppNotif(phone, 'bolamu_event_rappel', { params, event_data }, 'failed');
        return false;
    }
}

async function notifyClubInscription(patient_phone, club_data) {
    const phone = normalizePhone(patient_phone);
    const params = [
        club_data.nom_club || '',
        club_data.date || '',
        club_data.heure || '',
        club_data.lieu || ''
    ];

    try {
        const ok = await sendAutoMessage(phone, 'bolamu_event_rappel', params);
        await _saveWhatsAppNotif(phone, 'bolamu_club_inscription', { params, club_data }, ok ? 'sent' : 'failed', ok ? new Date() : null);
        return ok;
    } catch (err) {
        logger.error('[WA Notif] notifyClubInscription:', err.message);
        await _saveWhatsAppNotif(phone, 'bolamu_club_inscription', { params, club_data }, 'failed');
        return false;
    }
}

async function notifyZoraAttribues(patient_phone, points, reason) {
    const phone = normalizePhone(patient_phone);

    let solde = 0;
    try {
        const res = await pool.query(
            `SELECT COALESCE(SUM(points), 0) as solde FROM zora_ledger WHERE phone = $1`,
            [phone]
        );
        solde = parseInt(res.rows[0].solde);
    } catch (_) {}

    const params = [
        String(points),
        reason || '',
        String(solde)
    ];

    try {
        const ok = await sendAutoMessage(phone, 'bolamu_checkin_confirme', params);
        await _saveWhatsAppNotif(phone, 'bolamu_zora_attribues', { points, reason, solde }, ok ? 'sent' : 'failed', ok ? new Date() : null);
        return ok;
    } catch (err) {
        logger.error('[WA Notif] notifyZoraAttribues:', err.message);
        await _saveWhatsAppNotif(phone, 'bolamu_zora_attribues', { points, reason }, 'failed');
        return false;
    }
}

async function notifyVoucherGenere(patient_phone, voucher_data) {
    const phone = normalizePhone(patient_phone);
    const params = [
        voucher_data.titre || '',
        voucher_data.partenaire || '',
        voucher_data.date_expiration || ''
    ];

    try {
        const ok = await sendWhatsAppTemplate(phone, 'voucher_expirant', params);
        await _saveWhatsAppNotif(phone, 'voucher_expirant', { params, voucher_data }, ok ? 'sent' : 'failed', ok ? new Date() : null);
        return ok;
    } catch (err) {
        logger.error('[WA Notif] notifyVoucherGenere:', err.message);
        await _saveWhatsAppNotif(phone, 'voucher_expirant', { params, voucher_data }, 'failed');
        return false;
    }
}

module.exports = {
    notify,
    notifyLite,
    hasActivePushSubscription,
    notifyRdvConfirme,
    notifyEvenementInscription,
    notifyClubInscription,
    notifyZoraAttribues,
    notifyVoucherGenere
};
