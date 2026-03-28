const AfricasTalking = require('africastalking');

// Initialisation avec tes clés (Render récupère bien AT_API_KEY et AT_USERNAME)
const at = AfricasTalking({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME
});

const sms = at.SMS;

async function sendBolamuSms(to, message) {
    try {
        const options = {
            to: [to],
            message: message,
            // ⚠️ En Sandbox, on ne peut pas utiliser "Bolamu". 
            // On laisse vide ou on utilise le shortcode par défaut d'AT.
            from: process.env.AT_USERNAME === 'sandbox' ? undefined : (process.env.AT_SENDER_ID || 'Bolamu')
        };
        
        const result = await sms.send(options);
        console.log("📲 SMS envoyé avec succès :", result);
        return result;
    } catch (err) {
        console.error("❌ Erreur d'envoi SMS Bolamu :", err.message);
        // On ne "throw" pas l'erreur pour ne pas faire crasher tout le serveur 
        // si le SMS échoue, on veut quand même que le patient soit créé.
        return null; 
    }
}

module.exports = { sendBolamuSms };
