const crypto = require('crypto');

/**
 * Middleware de validation HMAC pour les webhooks MTN MoMo
 * Valide que la requête vient bien de MTN MoMo en vérifiant la signature
 */
function validateMtnWebhook(req, res, next) {
    // MTN MoMo envoie la signature dans le header X-Callback-Signature
    const signature = req.headers['x-callback-signature'] || req.headers['X-Callback-Signature'];
    
    if (!signature) {
        console.error('[Webhook MTN] Signature manquante dans les headers');
        return res.status(401).json({ 
            success: false, 
            message: 'Signature manquante - Requête non autorisée' 
        });
    }

    // Récupérer le secret depuis les variables d'environnement
    const webhookSecret = process.env.MTN_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
        console.error('[Webhook MTN] MTN_WEBHOOK_SECRET non configuré');
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
            console.error('[Webhook MTN] Longueur signature incorrecte');
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
            console.error('[Webhook MTN] Signature invalide');
            return res.status(401).json({ 
                success: false, 
                message: 'Signature invalide - Requête non autorisée' 
            });
        }

        // Signature valide, continuer
        console.log('[Webhook MTN] Signature validée avec succès');
        next();

    } catch (err) {
        console.error('[Webhook MTN] Erreur validation signature:', err.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Erreur lors de la validation de la signature' 
        });
    }
}

module.exports = validateMtnWebhook;
