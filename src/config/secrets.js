// ============================================================
// BOLAMU — Configuration Secrets Validation (Sprint 6)
// ============================================================

// Variables critiques PRODUCTION à valider au démarrage
const REQUIRED_PRODUCTION_VARS = [
    'DATABASE_URL',
    'JWT_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'AT_API_KEY',
    'AT_USERNAME',
    'MTN_MOMO_PRIMARY_KEY',
    'MTN_WEBHOOK_SECRET',
    'AIRTEL_CLIENT_ID',
    'AIRTEL_CLIENT_SECRET',
    'AIRTEL_WEBHOOK_SECRET',
    'RESEND_API_KEY'
];

function validateSecrets() {
    const isProduction = process.env.NODE_ENV === 'production';
    const missingVars = [];

    for (const varName of REQUIRED_PRODUCTION_VARS) {
        if (!process.env[varName]) {
            if (isProduction) {
                missingVars.push(varName);
            } else {
                console.warn(`[SECRETS] Variable manquante (développement) : ${varName}`);
            }
        }
    }

    if (isProduction && missingVars.length > 0) {
        console.error('[SECRETS] Variables manquantes en production :');
        missingVars.forEach(varName => {
            console.error(`  - ${varName}`);
        });
        console.error('[SECRETS] Arrêt du serveur. Configurez ces variables dans Render.');
        process.exit(1);
    }

    if (isProduction) {
        console.log('[SECRETS] Toutes les variables critiques sont configurées ✅');
    }
}

// Valider au démarrage
validateSecrets();

module.exports = {
    validateSecrets,
    REQUIRED_PRODUCTION_VARS
};
