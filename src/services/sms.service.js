// ============================================================
// BOLAMU — Service SMS Africa's Talking (Sprint 6)
// ============================================================
const AfricasTalking = require('africastalking');
const logger = require('../config/logger');

// Vérification fail-fast de AT_API_KEY en production
if (process.env.NODE_ENV === 'production' && !process.env.AT_API_KEY) {
    console.error('[SMS] AT_API_KEY requis en production');
    process.exit(1);
}

if (process.env.NODE_ENV === 'production' && !process.env.AT_USERNAME) {
    console.error('[SMS] AT_USERNAME requis en production');
    process.exit(1);
}

// Initialisation avec tes clés (Render récupère bien AT_API_KEY et AT_USERNAME)
const at = AfricasTalking({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME
});

const sms = at.SMS;

// Retry automatique avec délai exponentiel
async function sendWithRetry(to, message, maxRetries = 3, attempt = 1) {
    try {
        const options = {
            to: [to],
            message: message,
            from: process.env.AT_USERNAME === 'sandbox' ? undefined : (process.env.AT_SENDER_ID || 'Bolamu')
        };
        
        const result = await sms.send(options);
        logger.info('SMS envoyé avec succès', { to, attempt });
        return result;
    } catch (err) {
        logger.error('Erreur envoi SMS', { to, attempt, error: err.message });
        
        if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000; // Délai exponentiel : 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delay));
            return sendWithRetry(to, message, maxRetries, attempt + 1);
        }
        
        // Échec après tous les retries
        logger.error('SMS échoué après tous les retries', { to, attempt });
        return null;
    }
}

async function sendBolamuSms(to, message) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (isDevelopment) {
        // En développement : logger le SMS sans l'envoyer
        logger.info('SMS simulé (développement)', { to, message });
        console.log(`[SMS SIMULÉ] Vers: ${to} | Message: ${message}`);
        return { simulated: true };
    }
    
    // En production : utiliser Africa's Talking avec retry automatique
    return await sendWithRetry(to, message);
}

module.exports = { sendBolamuSms };
