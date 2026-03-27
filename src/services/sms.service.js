const AfricasTalking = require('africastalking');

// On initialise avec tes clés du fichier .env
const at = AfricasTalking({
    apiKey: process.env.AT_API_KEY || 'sandbox', // Utilise sandbox par défaut
    username: process.env.AT_USERNAME || 'sandbox'
});

const sms = at.SMS;

async function sendBolamuSms(to, message) {
    try {
        const options = {
            to: [to],
            message: message,
            from: process.env.AT_SENDER_ID || 'Bolamu'
        };
        const result = await sms.send(options);
        console.log("📲 Résultat Africa's Talking :", result);
        return result;
    } catch (err) {
        console.error("❌ Erreur d'envoi SMS Bolamu :", err.message);
        throw err;
    }
}

module.exports = { sendBolamuSms };
