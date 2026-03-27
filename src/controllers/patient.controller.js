// ============================================================
// BOLAMU — Contrôleur patients
// ============================================================
const pool = require('../config/db');

// Récupère un paramètre financier depuis platform_config
async function getConfig(key) {
    const result = await pool.query(
        'SELECT value FROM platform_config WHERE key = $1',
        [key]
    );
    return result.rows.length > 0 ? result.rows[0].value : null;
}

// ----------------------------------------------------------------
// POST /api/v1/patients/register
// ----------------------------------------------------------------
async function registerPatient(req, res) {
    const { phone, full_name, birth_date, gender } = req.body;

    if (!phone || !full_name) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : phone, full_name'
        });
    }

    try {
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

        const newUser = await pool.query(
            `INSERT INTO users (phone, full_name, birth_date, gender, role, is_active, created_at)
             VALUES ($1, $2, $3, $4, 'patient', TRUE, NOW())
             RETURNING id, phone, full_name, created_at`,
            [phone, full_name, birth_date || null, gender || null]
        );

        await pool.query(
            `INSERT INTO audit_log (user_phone, action, details, created_at)
             VALUES ($1, 'PATIENT_REGISTERED', $2, NOW())`,
            [phone, JSON.stringify({ full_name })]
        );

        return res.status(201).json({
            success: true,
            message: 'Patient enregistré avec succès.',
            data: newUser.rows[0]
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
// Retourne l'abonnement actif du patient
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