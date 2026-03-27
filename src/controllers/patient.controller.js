// ============================================================
// BOLAMU — Contrôleur inscription patient
// POST /api/v1/patients/register
// ============================================================

const pool = require('../config/db');

// Récupère un paramètre financier depuis platform_config
async function getConfig(key) {
    const result = await pool.query(
        'SELECT config_value FROM platform_config WHERE config_key = $1',
        [key]
    );
    if (!result.rows[0]) throw new Error(`Config manquante : ${key}`);
    return result.rows[0].config_value;
}

// Montant FCFA selon la formule choisie
async function getPlanAmount(plan) {
    const key = `price_${plan}`; // price_essentiel, price_standard, price_premium
    const value = await getConfig(key);
    return parseInt(value);
}

// ----------------------------------------------------------------
// POST /api/v1/patients/register
// Body attendu :
// {
//   "phone": "+242XXXXXXXXX",
//   "full_name": "Jean Mokoko",
//   "plan": "essentiel" | "standard" | "premium"
// }
// ----------------------------------------------------------------
async function registerPatient(req, res) {
    const { phone, full_name, plan } = req.body;

    // --- Validation des champs obligatoires ---
    if (!phone || !full_name || !plan) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : phone, full_name, plan'
        });
    }

    // --- Validation de la formule ---
    const plansAutorises = ['essentiel', 'standard', 'premium'];
    if (!plansAutorises.includes(plan)) {
        return res.status(400).json({
            success: false,
            message: `Formule invalide. Choisir parmi : ${plansAutorises.join(', ')}`
        });
    }

    // --- Validation format téléphone ---
    const phoneRegex = /^\+242[0-9]{9}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({
            success: false,
            message: 'Numéro de téléphone invalide. Format attendu : +242XXXXXXXXX'
        });
    }

    // On démarre une transaction — tout réussit ou rien n'est enregistré
    // C'est comme signer tous les documents en même temps chez le notaire
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // --- Vérifier si le patient existe déjà ---
        const existingUser = await client.query(
            'SELECT id, is_active FROM users WHERE phone = $1',
            [phone]
        );

        let userId;

        if (existingUser.rows.length > 0) {
            // Le patient existe déjà
            if (!existingUser.rows[0].is_active) {
                return res.status(403).json({
                    success: false,
                    message: 'Ce compte est suspendu. Contacter le support Bolamu.'
                });
            }
            userId = existingUser.rows[0].id;
        } else {
            // Nouveau patient — on crée son compte dans users
            const newUser = await client.query(
                `INSERT INTO users (phone, user_type, is_active)
                 VALUES ($1, 'patient', TRUE)
                 RETURNING id`,
                [phone]
            );
            userId = newUser.rows[0].id;
        }

        // --- Vérifier s'il a déjà un abonnement actif ---
        const abonnementActif = await client.query(
            `SELECT id FROM subscriptions
             WHERE patient_phone = $1
               AND status = 'active'
               AND is_active = TRUE
               AND expires_at > NOW()`,
            [phone]
        );

        if (abonnementActif.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'Ce patient a déjà un abonnement actif.'
            });
        }

        // --- Récupérer le montant depuis platform_config (jamais hardcodé) ---
        const montant = await getPlanAmount(plan);

        // --- Récupérer la durée depuis platform_config ---
        const dureeDays = parseInt(await getConfig('subscription_duration_days'));

        // --- Créer l'abonnement ---
        const dateDebut = new Date();
        const dateFin = new Date();
        dateFin.setDate(dateFin.getDate() + dureeDays);

        const subscription = await client.query(
            `INSERT INTO subscriptions
                (patient_phone, plan, amount_fcfa, status, started_at, expires_at, is_active)
             VALUES ($1, $2, $3, 'active', $4, $5, TRUE)
             RETURNING id, plan, amount_fcfa, started_at, expires_at`,
            [phone, plan, montant, dateDebut, dateFin]
        );

        // --- Mettre à jour statut_abonnement dans users (synchronisation) ---
        await client.query(
            `UPDATE users
             SET statut_abonnement = 'actif',
                 date_fin_abonnement = $1
             WHERE phone = $2`,
            [dateFin, phone]
        );

        // --- Audit log (immuable) ---
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('patient.registered', $1, 'subscriptions', $2, $3)`,
            [
                phone,
                subscription.rows[0].id,
                JSON.stringify({ plan, montant, expires_at: dateFin })
            ]
        );

        // Tout s'est bien passé — on valide
        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Inscription patient réussie.',
            data: {
                phone,
                full_name,
                plan: subscription.rows[0].plan,
                montant_fcfa: subscription.rows[0].amount_fcfa,
                abonnement_debut: subscription.rows[0].started_at,
                abonnement_fin: subscription.rows[0].expires_at
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerPatient] Erreur :', error.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Réessayer.'
        });
    } finally {
        client.release();
    }
}

module.exports = { registerPatient };