const pool = require('../config/db');
const { generateOtp, simulateSendOtp } = require('../utils/otp');
const { hashText } = require('../utils/hash');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';
const JWT_EXPIRES = '7d'; // Token valable 7 jours

// ============================================================
// 1. DEMANDER OTP
// ============================================================
async function requestOtp(req, res) {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({
            success: false,
            message: "Numéro requis"
        });
    }

    const otpCode = generateOtp();
    const hashedOtp = hashText(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60000);

    try {
        await pool.query(
            `INSERT INTO otp_codes (phone, hashed_otp, expires_at, attempts) 
             VALUES ($1, $2, $3, 0) 
             ON CONFLICT (phone) DO UPDATE 
             SET hashed_otp = $2, expires_at = $3, attempts = 0`,
            [phone, hashedOtp, expiresAt]
        );

        simulateSendOtp(phone, otpCode);

        return res.status(200).json({
            success: true,
            message: "OTP envoyé"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Erreur génération OTP"
        });
    }
}

// ============================================================
// 2. VERIFY OTP
// ============================================================
async function verifyOtp(req, res) {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({
            success: false,
            message: "Téléphone et OTP requis"
        });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM otp_codes WHERE phone = $1`,
            [phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Aucun OTP trouvé"
            });
        }

        const record = result.rows[0];

        if (new Date() > new Date(record.expires_at)) {
            return res.status(400).json({
                success: false,
                message: "OTP expiré"
            });
        }

        if (record.attempts >= 5) {
            return res.status(403).json({
                success: false,
                message: "Trop de tentatives"
            });
        }

        const hashedInput = hashText(otp);

        if (hashedInput !== record.hashed_otp) {
            await pool.query(
                `UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1`,
                [phone]
            );
            return res.status(401).json({
                success: false,
                message: "Code incorrect"
            });
        }

        await pool.query(
            `DELETE FROM otp_codes WHERE phone = $1`,
            [phone]
        );

        return res.status(200).json({
            success: true,
            message: "OTP validé"
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur"
        });
    }
}

// ============================================================
// 3. LOGIN COMPLET (OTP → JWT → DASHBOARD)
// ============================================================
async function login(req, res) {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({
            success: false,
            message: "Téléphone et OTP requis"
        });
    }

    try {
        const otpResult = await pool.query(
            `SELECT * FROM otp_codes WHERE phone = $1`,
            [phone]
        );

        if (otpResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "OTP non trouvé"
            });
        }

        const record = otpResult.rows[0];

        if (new Date() > new Date(record.expires_at)) {
            return res.status(400).json({
                success: false,
                message: "OTP expiré"
            });
        }

        if (record.attempts >= 5) {
            return res.status(403).json({
                success: false,
                message: "Trop de tentatives"
            });
        }

        const hashedInput = hashText(otp);

        if (hashedInput !== record.hashed_otp) {
            await pool.query(
                `UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1`,
                [phone]
            );
            return res.status(401).json({
                success: false,
                message: "OTP invalide"
            });
        }

        await pool.query(
            `DELETE FROM otp_codes WHERE phone = $1`,
            [phone]
        );

        // Récupérer utilisateur
        const userResult = await pool.query(
            `SELECT id, phone, role FROM users WHERE phone = $1`,
            [phone]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable"
            });
        }

        const user = userResult.rows[0];

        // 🔐 Générer le token JWT
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        // Redirection selon rôle
        let redirectUrl = "/login.html";
        switch (user.role) {
            case 'patient':    redirectUrl = "/patient/dashboard.html"; break;
            case 'doctor':     redirectUrl = "/medecin/dashboard.html"; break;
            case 'pharmacy':   redirectUrl = "/pharmacie/dashboard.html"; break;
            case 'laboratory': redirectUrl = "/laboratoire/dashboard.html"; break;
        }

        return res.status(200).json({
            success: true,
            message: "Connexion réussie",
            token,
            role: user.role,
            phone: user.phone,
            redirectUrl
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: "Erreur login"
        });
    }
}

module.exports = { requestOtp, verifyOtp, login };