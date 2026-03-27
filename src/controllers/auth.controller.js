const pool = require('../config/db');
const { generateOtp, simulateSendOtp } = require('../utils/otp');
const { hashText } = require('../utils/hash');

// 1. Fonction pour DEMANDER un code OTP
async function requestOtp(req, res) {
    const { phone } = req.body;
    const otpCode = generateOtp();
    const hashedOtp = hashText(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60000); // Valide 10 min

    try {
        // Enregistre ou met à jour le code pour ce numéro
        await pool.query(
            `INSERT INTO otp_codes (phone, hashed_otp, expires_at, attempts) 
             VALUES ($1, $2, $3, 0) 
             ON CONFLICT (phone) DO UPDATE 
             SET hashed_otp = $2, expires_at = $3, attempts = 0`,
            [phone, hashedOtp, expiresAt]
        );

        simulateSendOtp(phone, otpCode);
        res.status(200).json({ message: "OTP envoyé avec succès" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de la génération de l'OTP" });
    }
}

// 2. Fonction pour VÉRIFIER le code OTP
async function verifyOtp(req, res) {
    const { phone, otp } = req.body;
    // Logique de vérification simplifiée pour le test
    res.status(200).json({ message: "Fonction de vérification prête" });
}

// IMPORTANT : On exporte les fonctions pour que les routes les voient
module.exports = { requestOtp, verifyOtp };
