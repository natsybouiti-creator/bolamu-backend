const pool = require('../config/db');
const { sendAutoMessage } = require('../services/whatsapp-web.service');
const { generateOnboardingToken, getOnboardingExpiry, buildOnboardingLink } = require('./onboarding');

/**
 * Génère un magic link de première connexion et l'envoie par WhatsApp.
 * Non bloquant : toute erreur est loggée mais ne casse pas le flux appelant.
 * @param {string} phone - Numéro normalisé (+242XXXXXXXXX)
 * @param {string} fullName - Nom complet de l'utilisateur
 * @param {string} role - Rôle de l'utilisateur
 * @returns {string|null} Le lien généré (pour log), ou null si échec
 */
async function sendOnboardingLink(phone, fullName, role) {
    try {
        const token = generateOnboardingToken();
        const expiry = getOnboardingExpiry();

        await pool.query(
            `UPDATE users SET onboarding_token = $1, onboarding_token_expires_at = $2 WHERE phone = $3`,
            [token, expiry, phone]
        );

        const onboardingLink = buildOnboardingLink(token);

        await sendAutoMessage(phone, 'bolamu_magic_link', [fullName, onboardingLink]);

        console.log('[Onboarding] Magic link envoyé', { phone, role });
        return onboardingLink;
    } catch (err) {
        console.warn('[Onboarding] Envoi magic link échoué (non bloquant)', { phone, role, error: err.message });
        return null;
    }
}

module.exports = { sendOnboardingLink };
