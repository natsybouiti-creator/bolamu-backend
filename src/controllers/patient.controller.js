// ============================================================
// BOLAMU — Contrôleur patients (Version Sécurisée ID + PIN)
// ============================================================
const pool = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');

// 1. GÉNÉRATEURS AUTOMATIQUES
const generateBolamuId = () => `BOL-${Math.floor(1000 + Math.random() * 9000)}`;
const generateSecretPin = () => Math.floor(1000 + Math.random() * 9000).toString();

// ----------------------------------------------------------------
// POST /api/v1/patients/register
// ----------------------------------------------------------------
async function registerPatient(req, res) {
    const { phone, full_name, birth_date, gender, plan } = req.body;

    if (!phone || !full_name) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : phone, full_name'
        });
    }

    try {
        // Vérifier si le numéro existe déjà
        const existing = await pool.query(
            'SELECT id FROM users WHERE phone = $1',
            [phone]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Ce numéro est déjà enregistré.'
            });
        }

        // GÉNÉRATION DES IDENTIFIANTS SÉCURISÉS
        const bolamuId = generateBolamuId();
        const secretPin = generateSecretPin();

        // INSERTION DANS LA TABLE USERS (Inclus ID Bolamu et PIN)
        const newUser = await pool.query(
            `INSERT INTO users (
                phone, full_name, birth_date, gender, role, 
                bolamu_id, secret_pin, is_active, created_at
             )
             VALUES ($1, $2, $3, $4, 'patient', $5, $6, TRUE, NOW())
             RETURNING id, phone, full_name, bolamu_id, created_at`,
            [phone, full_name, birth_date || null, gender || null, bolamuId, secretPin]
        );

        // LOG D'AUDIT
        await pool.query(
            `INSERT INTO audit_log (user_phone, action, details, created_at)
             VALUES ($1, 'PATIENT_REGISTERED', $2, NOW())`,
            [phone, JSON.stringify({ full_name, bolamu_id: bolamuId })]
        );

        // ENVOI DU SMS DE BIENVENUE AVEC LES IDENTIFIANTS
        const messageSms = `Bienvenue chez Bolamu ! Votre ID : ${bolamuId}. Votre code PIN secret : ${secretPin}. Gardez-le pour vous connecter.`;
        
        try {
            await sendBolamuSms(phone, messageSms);
        } catch (smsErr) {
            console.error("⚠️ SMS non envoyé, mais identifiants créés :", bolamuId);
        }

        return res.status(201).json({
            success: true,
            message: 'Patient enregistré. Identifiants envoyés par SMS.',
            data: {
                id: newUser.rows[0].id,
                bolamu_id: newUser.rows[0].bolamu_id,
                full_name: newUser.rows[0].full_name,
                pin_code_sent: true
            }
        });

    } catch (error) {
        console.error('[registerPatient] Erreur :', error.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Réessayer.'
        });
    }
}

// ----------------------------------------------------------------
// GET /api/v1/patients/subscription?phone=+242XXXXXXXXX
// ----------------------------------------------------------------
async function getSubscription(req, res) {
    const { phone } = req.query;

    if (!phone) {
        return res.status(400).json({
            success: false,
            message: 'Paramètre manquant : phone'
        });
    }

    try {
        const result = await pool.query(
            `SELECT plan, amount_fcfa, status, started_at, expires_at
             FROM subscriptions
             WHERE patient_phone = $1
               AND status = 'active'
               AND is_active = TRUE
               AND expires_at > NOW()
             ORDER BY started_at DESC
             LIMIT 1`,
            [phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucun abonnement actif trouvé.'
            });
        }

        return res.status(200).json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[getSubscription] Erreur :', error.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Réessayer.'
        });
    }
}

module.exports = { registerPatient, getSubscription };
