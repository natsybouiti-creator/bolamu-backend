// ============================================================
// BOLAMU — Service Push Notifications (Web Push API) (Sprint 7)
// ============================================================
const webpush = require('web-push');
const pool = require('../config/db');
const logger = require('../config/logger');

// Configuration VAPID
let pushEnabled = false;

function configurePush() {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        logger.warn('[Push] VAPID keys non configurées - notifications push désactivées');
        return;
    }

    try {
        webpush.setVapidDetails(
            'mailto:contact@bolamu.co',
            process.env.VAPID_PUBLIC_KEY,
            process.env.VAPID_PRIVATE_KEY
        );
        pushEnabled = true;
        logger.info('[Push] VAPID configuré avec succès');
    } catch (error) {
        logger.error('[Push] Erreur configuration VAPID:', error.message);
        logger.warn('[Push] Notifications push désactivées');
    }
}

// S'abonner aux notifications push
async function subscribe(user_phone, { endpoint, p256dh, auth, device_type = 'web' }) {
    try {
        // Upsert dans push_subscriptions
        await pool.query(`
            INSERT INTO push_subscriptions (user_phone, endpoint, p256dh, auth, device_type, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5, TRUE, NOW())
            ON CONFLICT (user_phone, endpoint) 
            DO UPDATE SET is_active = TRUE, device_type = $5
        `, [user_phone, endpoint, p256dh, auth, device_type]);

        logger.info('[Push] Subscription enregistrée', { user_phone, device_type });
        return { success: true };
    } catch (error) {
        logger.error('[Push] Erreur subscription:', error.message);
        // Ne jamais bloquer l'opération principale
        return { success: false, error: error.message };
    }
}

// Se désabonner des notifications push
async function unsubscribe(user_phone, endpoint) {
    try {
        // Soft delete : is_active = false
        await pool.query(`
            UPDATE push_subscriptions 
            SET is_active = FALSE 
            WHERE user_phone = $1 AND endpoint = $2
        `, [user_phone, endpoint]);

        logger.info('[Push] Subscription désactivée', { user_phone });
        return { success: true };
    } catch (error) {
        logger.error('[Push] Erreur unsubscribe:', error.message);
        return { success: false, error: error.message };
    }
}

// Envoyer notification à un utilisateur
async function sendToUser(user_phone, { titre, message, type, data = {} }) {
    if (!pushEnabled) {
        logger.info('[Push] Notifications push désactivées - envoi ignoré');
        return { success: true, sent: 0 };
    }

    try {
        // Récupérer toutes les push_subscriptions actives du user
        const subscriptionsResult = await pool.query(`
            SELECT endpoint, p256dh, auth 
            FROM push_subscriptions 
            WHERE user_phone = $1 AND is_active = TRUE
        `, [user_phone]);

        if (subscriptionsResult.rows.length === 0) {
            logger.info('[Push] Aucune subscription active', { user_phone });
            return { success: true, sent: 0 };
        }

        const payload = JSON.stringify({
            title: titre,
            body: message,
            type,
            data
        });

        let sentCount = 0;
        let failedCount = 0;

        for (const subscription of subscriptionsResult.rows) {
            try {
                const pushSubscription = {
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: subscription.p256dh,
                        auth: subscription.auth
                    }
                };

                await webpush.sendNotification(pushSubscription, payload);
                sentCount++;
            } catch (error) {
                // Si erreur 410 (subscription expirée) : is_active = false
                if (error.statusCode === 410) {
                    await pool.query(`
                        UPDATE push_subscriptions 
                        SET is_active = FALSE 
                        WHERE endpoint = $1
                    `, [subscription.endpoint]);
                    logger.info('[Push] Subscription expirée désactivée', { endpoint: subscription.endpoint });
                }
                failedCount++;
                logger.error('[Push] Erreur envoi notification:', error.message);
            }
        }

        // INSERT dans notifications avec canal='push' + sent_at
        await pool.query(`
            INSERT INTO notifications (user_phone, type, titre, message, data, canal, is_read, sent_at, created_at)
            VALUES ($1, $2, $3, $4, $5, 'push', FALSE, NOW(), NOW())
        `, [user_phone, type, titre, message, JSON.stringify(data)]);

        logger.info('[Push] Notification envoyée', { user_phone, sent: sentCount, failed: failedCount });
        return { success: true, sent: sentCount, failed: failedCount };
    } catch (error) {
        logger.error('[Push] Erreur sendToUser:', error.message);
        // Ne jamais bloquer l'opération principale
        return { success: false, error: error.message };
    }
}

// Envoyer notification à tous les utilisateurs
async function sendToAll(titre, message, type, data = {}) {
    if (!pushEnabled) {
        logger.info('[Push] Notifications push désactivées - envoi ignoré');
        return { success: true, sent: 0 };
    }

    try {
        // Récupérer toutes les subscriptions actives
        const subscriptionsResult = await pool.query(`
            SELECT endpoint, p256dh, auth, user_phone 
            FROM push_subscriptions 
            WHERE is_active = TRUE
        `);

        if (subscriptionsResult.rows.length === 0) {
            logger.info('[Push] Aucune subscription active globale');
            return { success: true, sent: 0 };
        }

        const payload = JSON.stringify({
            title: titre,
            body: message,
            type,
            data
        });

        let sentCount = 0;
        let failedCount = 0;

        // Envoyer par batch de 100
        const batchSize = 100;
        for (let i = 0; i < subscriptionsResult.rows.length; i += batchSize) {
            const batch = subscriptionsResult.rows.slice(i, i + batchSize);

            for (const subscription of batch) {
                try {
                    const pushSubscription = {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.p256dh,
                            auth: subscription.auth
                        }
                    };

                    await webpush.sendNotification(pushSubscription, payload);
                    sentCount++;
                } catch (error) {
                    if (error.statusCode === 410) {
                        await pool.query(`
                            UPDATE push_subscriptions 
                            SET is_active = FALSE 
                            WHERE endpoint = $1
                        `, [subscription.endpoint]);
                    }
                    failedCount++;
                }
            }
        }

        logger.info('[Push] Notification globale envoyée', { sent: sentCount, failed: failedCount });
        return { success: true, sent: sentCount, failed: failedCount };
    } catch (error) {
        logger.error('[Push] Erreur sendToAll:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    configurePush,
    subscribe,
    unsubscribe,
    sendToUser,
    sendToAll
};
