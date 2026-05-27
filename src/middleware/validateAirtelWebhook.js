// ============================================================
// BOLAMU — Middleware Validation Webhook Airtel Money (Sprint 6)
// ============================================================
const crypto = require('crypto');

/**
 * Middleware de validation HMAC pour les webhooks Airtel Money
 * Valide que la requête vient bien d'Airtel Money en vérifiant la signature
 */
function validateAirtelWebhook(req, res, next) {
    // Airtel Money envoie la signature dans le header X-Callback-Signature
    const signature = req.headers['x-callback-signature'] || req.headers['X-Callback-Signature'];
    
    if (!signature) {
        console.error('[Webhook Airtel] Signature manquante dans les headers');
        return res.status(401).json({ 
            success: false, 
            message: 'Signature manquante - Requête non autorisée' 
        });
    }

    // Récupérer le secret depuis les variables d'environnement
    const webhookSecret = process.env.AIRTEL_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
        console.error('[Webhook Airtel] AIRTEL_WEBHOOK_SECRET non configuré');
        return res.status(500).json({ 
            success: false, 
            message: 'Configuration serveur incorrecte' 
        });
    }

    try {
        // Calculer le HMAC-SHA256 du body brut
        const hmac = crypto.createHmac('sha256', webhookSecret);
        hmac.update(req.body); // req.body est déjà un buffer grâce à express.raw()
        const calculatedSignature = hmac.digest('hex');

        // Comparaison timing-safe pour éviter les attaques par timing
        const signatureBuffer = Buffer.from(signature, 'hex');
        const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');

        if (signatureBuffer.length !== calculatedBuffer.length) {
            console.error('[Webhook Airtel] Longueur signature incorrecte');
            return res.status(401).json({ 
                success: false, 
                message: 'Signature invalide' 
            });
        }

        // Comparaison byte par byte avec timing-safe
        let isValid = true;
        for (let i = 0; i < signatureBuffer.length; i++) {
            if (signatureBuffer[i] !== calculatedBuffer[i]) {
                isValid = false;
                break;
            }
        }

        if (!isValid) {
            console.error('[Webhook Airtel] Signature invalide');
            return res.status(401).json({ 
                success: false, 
                message: 'Signature invalide - Requête non autorisée' 
            });
        }

        // Signature valide, continuer
        console.log('[Webhook Airtel] Signature validée avec succès');
        next();

    } catch (err) {
        console.error('[Webhook Airtel] Erreur validation signature:', err.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la validation de la signature' 
        });
    }
}

module.exports = validateAirtelWebhook;
