// ============================================================
// BOLAMU — Contrôleur Patients
// ============================================================
const pool = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');

const generateBolamuId = () => `BLM-${Math.floor(1000 + Math.random() * 9000)}`;

// ─── INSCRIPTION PATIENT ──────────────────────────────────────────────────────
async function registerPatient(req, res) {
    const { phone, full_name, birth_date, gender, city, momo_number, cgu_accepted } = req.body;

    if (!phone || !full_name) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : phone, full_name' });
    }

    if (!/^\+242[0-9]{9}$/.test(phone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    try {
        const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Ce numéro est déjà enregistré.' });
        }

        const bolamuId = generateBolamuId();

        const newUser = await pool.query(
            `INSERT INTO users
                (phone, full_name, birth_date, gender, role, bolamu_id, is_active,
                 momo_number, cgu_accepted, cgu_accepted_at, onboarding_completed, created_at)
             VALUES ($1,$2,$3,$4,'patient',$5,TRUE,$6,$7,NOW(),TRUE,NOW())
             RETURNING id, phone, full_name, bolamu_id, created_at`,
            [
                phone, full_name, birth_date || null, gender || null,
                bolamuId, momo_number || phone,
                cgu_accepted === 'true' || cgu_accepted === true
            ]
        );

        // Audit log avec les bonnes colonnes
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('patient.registered', $1, 'users', $2, $3)`,
            [phone, newUser.rows[0].id, JSON.stringify({ full_name, bolamu_id: bolamuId })]
        ).catch(() => {});

        try {
            await sendBolamuSms(phone,
                `Bolamu : Bienvenue ${full_name} ! Votre ID Bolamu : ${bolamuId}. Connectez-vous sur bolamu-backend.onrender.com`
            );
        } catch (e) { console.log('⚠️ SMS non envoyé'); }

        return res.status(201).json({
            success: true,
            message: 'Inscription réussie !',
            data: {
                bolamu_id: bolamuId,
                full_name: newUser.rows[0].full_name,
                phone: newUser.rows[0].phone,
                auto_validated: true,
                trust_score: 85,
                member_code: bolamuId
            }
        });

    } catch (error) {
        console.error('[registerPatient]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    }
}

// ─── ABONNEMENT ACTIF ─────────────────────────────────────────────────────────
async function getSubscription(req, res) {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Paramètre phone manquant.' });

    try {
        const result = await pool.query(
            `SELECT plan, amount_fcfa, status, started_at, expires_at
             FROM subscriptions
             WHERE patient_phone = $1 AND status = 'active' AND is_active = TRUE AND expires_at > NOW()
             ORDER BY started_at DESC LIMIT 1`,
            [phone]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Aucun abonnement actif trouvé.' });
        }

        return res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        console.error('[getSubscription]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = { registerPatient, getSubscription };