// ============================================================
// BOLAMU — Service Airtel Money (Sprint 6)
// ============================================================
const crypto = require('crypto');

// Configuration depuis process.env uniquement
const AIRTEL_BASE_URL = process.env.AIRTEL_BASE_URL || 'https://openapi.airtel.africa';
const AIRTEL_CLIENT_ID = process.env.AIRTEL_CLIENT_ID;
const AIRTEL_CLIENT_SECRET = process.env.AIRTEL_CLIENT_SECRET;

// ─── INITIER UN PAIEMENT Airtel Money ───────────────────────────────────────
async function initiatePayment(phone, amount, reference) {
    if (!AIRTEL_CLIENT_ID || !AIRTEL_CLIENT_SECRET) {
        throw new Error('AIRTEL_CLIENT_ID et AIRTEL_CLIENT_SECRET requis');
    }

    const credentials = Buffer.from(`${AIRTEL_CLIENT_ID}:${AIRTEL_CLIENT_SECRET}`).toString('base64');

    // Obtenir token OAuth2
    const tokenRes = await fetch(`${AIRTEL_BASE_URL}/auth/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: AIRTEL_CLIENT_ID,
            client_secret: AIRTEL_CLIENT_SECRET
        })
    });

    if (!tokenRes.ok) {
        throw new Error('Erreur obtention token Airtel');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Formater le numéro pour Airtel (242 au lieu de 2420)
    const airtelPhone = phone.replace('+', '').replace(/^2420/, '242');

    // Initier le paiement
    const bodyData = JSON.stringify({
        reference: reference,
        subscriber: {
            country: 'CG',
            currency: 'XAF',
            msisdn: airtelPhone
        },
        transaction: {
            amount: String(amount),
            country: 'CG',
            currency: 'XAF',
            id: reference
        }
    });

    const paymentRes = await fetch(`${AIRTEL_BASE_URL}/merchant/v2/payments/`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Country': 'CG',
            'X-Currency': 'XAF'
        },
        body: bodyData
    });

    const paymentData = await paymentRes.json();

    if (!paymentRes.ok) {
        throw new Error('Erreur initiation paiement Airtel');
    }

    return {
        transaction_id: paymentData.transaction?.id || reference,
        status: 'pending',
        reference
    };
}

// ─── VALIDER WEBHOOK Airtel Money (HMAC-SHA256) ───────────────────────────────
async function validateWebhook(headers, rawBody) {
    const signature = headers['x-callback-signature'] || headers['X-Callback-Signature'];
    const webhookSecret = process.env.AIRTEL_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
        return false;
    }

    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', webhookSecret);
    hmac.update(rawBody);
    const calculatedSignature = hmac.digest('hex');

    // Comparaison timing-safe
    const signatureBuffer = Buffer.from(signature, 'hex');
    const calculatedBuffer = Buffer.from(calculatedSignature, 'hex');

    if (signatureBuffer.length !== calculatedBuffer.length) {
        return false;
    }

    let isValid = true;
    for (let i = 0; i < signatureBuffer.length; i++) {
        if (signatureBuffer[i] !== calculatedBuffer[i]) {
            isValid = false;
            break;
        }
    }

    return isValid;
}

// ─── VÉRIFIER STATUT TRANSACTION Airtel Money ───────────────────────────────────
async function getTransactionStatus(transactionId) {
    if (!AIRTEL_CLIENT_ID || !AIRTEL_CLIENT_SECRET) {
        throw new Error('AIRTEL_CLIENT_ID et AIRTEL_CLIENT_SECRET requis');
    }

    const credentials = Buffer.from(`${AIRTEL_CLIENT_ID}:${AIRTEL_CLIENT_SECRET}`).toString('base64');

    // Obtenir token OAuth2
    const tokenRes = await fetch(`${AIRTEL_BASE_URL}/auth/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            grant_type: 'client_credentials',
            client_id: AIRTEL_CLIENT_ID,
            client_secret: AIRTEL_CLIENT_SECRET
        })
    });

    if (!tokenRes.ok) {
        throw new Error('Erreur obtention token Airtel');
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Vérifier statut
    const statusRes = await fetch(`${AIRTEL_BASE_URL}/standard/v1/payments/${transactionId}`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Country': 'CG',
            'X-Currency': 'XAF'
        }
    });

    const statusData = await statusRes.json();

    return {
        transaction_id: transactionId,
        status: statusData.status?.response_code,
        raw_status: statusData.status
    };
}

module.exports = {
    initiatePayment,
    validateWebhook,
    getTransactionStatus
};
