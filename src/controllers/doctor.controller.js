// ============================================================
// BOLAMU — Contrôleur médecins
// POST /api/v1/doctors/register
// GET  /api/v1/doctors
// ============================================================

const pool = require('../config/db');

// ----------------------------------------------------------------
// POST /api/v1/doctors/register
// ----------------------------------------------------------------
async function registerDoctor(req, res) {
    const {
        phone,
        full_name,
        specialty,
        registration_number,
        city,
        neighborhood,
        bio
    } = req.body;

    if (!phone || !full_name || !specialty || !registration_number || !city) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : phone, full_name, specialty, registration_number, city'
        });
    }

    const phoneRegex = /^\+242[0-9]{9}$/;
    if (!phoneRegex.test(phone)) {
        return res.status(400).json({
            success: false,
            message: 'Numéro de téléphone invalide. Format attendu : +242XXXXXXXXX'
        });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const existingDoctor = await client.query(
            'SELECT id FROM doctors WHERE phone = $1',
            [phone]
        );

        if (existingDoctor.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'Un médecin avec ce numéro existe déjà.'
            });
        }

        const existingRegistration = await client.query(
            'SELECT id FROM doctors WHERE registration_number = $1',
            [registration_number]
        );

        if (existingRegistration.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                message: 'Ce numéro d\'ordre médecin est déjà enregistré.'
            });
        }

        const existingUser = await client.query(
            'SELECT id FROM users WHERE phone = $1',
            [phone]
        );

        let userId;
        if (existingUser.rows.length === 0) {
            const newUser = await client.query(
                `INSERT INTO users (phone, user_type, is_active)
                 VALUES ($1, 'medecin', TRUE)
                 RETURNING id`,
                [phone]
            );
            userId = newUser.rows[0].id;
        } else {
            userId = existingUser.rows[0].id;
        }

        const newDoctor = await client.query(
            `INSERT INTO doctors
                (phone, user_id, full_name, specialty, registration_number,
                 city, neighborhood, bio, status, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', TRUE)
             RETURNING id, phone, full_name, specialty, city, status, created_at`,
            [
                phone,
                userId,
                full_name,
                specialty,
                registration_number,
                city,
                neighborhood || null,
                bio || null
            ]
        );

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('doctor.registered', $1, 'doctors', $2, $3)`,
            [
                phone,
                newDoctor.rows[0].id,
                JSON.stringify({ full_name, specialty, city, registration_number })
            ]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Inscription médecin reçue. En attente de vérification par Bolamu.',
            data: {
                id: newDoctor.rows[0].id,
                phone: newDoctor.rows[0].phone,
                full_name: newDoctor.rows[0].full_name,
                specialty: newDoctor.rows[0].specialty,
                city: newDoctor.rows[0].city,
                status: newDoctor.rows[0].status,
                created_at: newDoctor.rows[0].created_at
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerDoctor] Erreur :', error.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Réessayer.'
        });
    } finally {
        client.release();
    }
}

// ----------------------------------------------------------------
// GET /api/v1/doctors
// Paramètres optionnels (query string) :
//   ?specialty=Généraliste
//   ?city=Brazzaville
//   ?page=1&limit=20
// ----------------------------------------------------------------
async function getDoctors(req, res) {
    const { specialty, city, page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const conditions = [
            `d.is_active = TRUE`,
            `d.status = 'verified'`
        ];
        const params = [];

        if (specialty) {
            params.push(`%${specialty}%`);
            conditions.push(`d.specialty ILIKE $${params.length}`);
        }

        if (city) {
            params.push(`%${city}%`);
            conditions.push(`d.city ILIKE $${params.length}`);
        }

        const whereClause = conditions.join(' AND ');

        params.push(parseInt(limit));
        params.push(offset);

        const result = await pool.query(
            `SELECT
                d.id,
                d.full_name,
                d.specialty,
                d.city,
                d.neighborhood,
                d.bio,
                d.availability_schedule,
                d.total_consultations
             FROM doctors d
             WHERE ${whereClause}
             ORDER BY d.total_consultations DESC, d.created_at ASC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const countParams = params.slice(0, params.length - 2);
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM doctors d WHERE ${whereClause}`,
            countParams
        );

        const total = parseInt(countResult.rows[0].count);

        return res.status(200).json({
            success: true,
            data: {
                doctors: result.rows,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });

    } catch (error) {
        console.error('[getDoctors] Erreur :', error.message);
        return res.status(500).json({
            success: false,
            message: 'Erreur serveur. Réessayer.'
        });
    }
}

module.exports = { registerDoctor, getDoctors };