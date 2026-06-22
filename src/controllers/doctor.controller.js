// ============================================================
// BOLAMU — Contrôleur médecins
// ============================================================

const pool = require('../config/db');
const { sendWhatsAppTemplate } = require('../services/whatsapp.service');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { normalizePhone } = require('../utils/phone');
const logger = require('../config/logger');

function calculateTrustScore(data) {
    let score = 0;
    const details = [];
    if (/^\+242(06|05)[0-9]{7}$/.test(data.phone)) { score += 20; details.push({ check: 'phone_valid', points: 20 }); }
    if (data.registration_number && /^[A-Z0-9\-\/]{4,20}$/i.test(data.registration_number)) { score += 25; details.push({ check: 'registration_number_format', points: 25 }); }
    if (data.document_url) { score += 30; details.push({ check: 'document_uploaded', points: 30 }); }
    if (data.full_name && data.full_name.trim().split(' ').length >= 2) { score += 10; details.push({ check: 'full_name_valid', points: 10 }); }
    if (data.specialty && data.specialty.length > 3) { score += 10; details.push({ check: 'specialty_valid', points: 10 }); }
    if (data.city) { score += 5; details.push({ check: 'city_valid', points: 5 }); }
    return { score, details };
}


async function registerDoctor(req, res) {
    const phone = req.body?.phone;
    const full_name = req.body?.full_name;
    const specialty = req.body?.specialty;
    const registration_number = req.body?.registration_number;
    const city = req.body?.city;
    const neighborhood = req.body?.neighborhood;
    const bio = req.body?.bio;
    const momo_number = req.body?.momo_number;

    const normalizedPhone = normalizePhone(phone || '');
    if (!normalizedPhone || !full_name || !specialty || !registration_number || !city) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires manquants : phone, full_name, specialty, registration_number, city' });
    }
    if (!/^\+242[0-9]{9}$/.test(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Numéro invalide. Format : +242XXXXXXXXX' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const existingDoctor = await client.query('SELECT id FROM doctors WHERE phone = $1', [normalizedPhone]);
        if (existingDoctor.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Un médecin avec ce numéro existe déjà.' });
        }
        const existingReg = await client.query('SELECT id FROM doctors WHERE registration_number = $1', [registration_number]);
        if (existingReg.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Ce numéro d\'ordre est déjà enregistré.' });
        }

        let documentUrl = null;
        let documentPublicId = null;
        if (req.file) {
            try {
                const result = await uploadToCloudinary(req.file.buffer, 'bolamu/doctors/documents');
                documentUrl = result.secure_url;
                documentPublicId = result.public_id;
            } catch (e) { console.error('[Cloudinary doctor]', e.message); }
        }

        const { score, details } = calculateTrustScore({ phone: normalizedPhone, full_name, specialty, registration_number, city, document_url: documentUrl });
        const autoStatus = score >= 80 ? 'verified' : 'pending';
        const codeRes = await client.query(
            `SELECT COALESCE(MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)), 0) + 1 AS next
             FROM users WHERE role = 'doctor' AND member_code ~ '^MED-[0-9]+$'`
        );
        const memberCode = `MED-${codeRes.rows[0].next.toString().padStart(5, '0')}`;

        const existingUser = await client.query('SELECT id FROM users WHERE phone = $1', [normalizedPhone]);
        let userId;
        if (existingUser.rows.length === 0) {
            const newUser = await client.query(
                `INSERT INTO users (phone, full_name, role, is_active) VALUES ($1, $2, 'doctor', FALSE) RETURNING id`,
                [normalizedPhone, full_name]
            );
            userId = newUser.rows[0].id;
        } else {
            userId = existingUser.rows[0].id;
            await client.query(`UPDATE users SET full_name = $1, role = 'doctor' WHERE id = $2`, [full_name, userId]);
        }

        const newDoctor = await client.query(
            `INSERT INTO doctors
                (phone, user_id, full_name, specialty, registration_number,
                 city, neighborhood, bio, status, is_active, member_code,
                 document_url, document_public_id, trust_score, momo_number)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,$10,$11,$12,$13,$14)
             RETURNING id, phone, full_name, specialty, city, status, member_code, trust_score, created_at`,
            [normalizedPhone, userId, full_name, specialty, registration_number, city, neighborhood || null, bio || null,
             autoStatus, memberCode, documentUrl, documentPublicId, score, momo_number || normalizedPhone]
        );

        // Création automatique des disponibilités par défaut (lun-ven 08h-17h)
        const joursDefaut = [
            { day_of_week: 1, label: 'lundi' },
            { day_of_week: 2, label: 'mardi' },
            { day_of_week: 3, label: 'mercredi' },
            { day_of_week: 4, label: 'jeudi' },
            { day_of_week: 5, label: 'vendredi' }
        ];
        for (const jour of joursDefaut) {
            await client.query(
                `INSERT INTO doctor_availabilities
                 (doctor_id, day_of_week, start_time, end_time, slot_duration)
                 SELECT id, $1, '08:00', '17:00', 30
                 FROM users WHERE phone = $2
                 ON CONFLICT (doctor_id, day_of_week) DO NOTHING`,
                [jour.day_of_week, normalizedPhone]
            );
            await client.query(
                `INSERT INTO time_slots (doctor_phone, date, heure_debut, heure_fin)
                 VALUES ($1, CURRENT_DATE + INTERVAL '1 day' * $2, '08:00', '17:00')
                 ON CONFLICT DO NOTHING`,
                [normalizedPhone, jour.day_of_week - 1]
            );
        }

        if (documentUrl) {
            await client.query(
                `UPDATE users SET document_url = $1 WHERE phone = $2`,
                [documentUrl, normalizedPhone]
            );
        }

        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('doctor.registered', $1, 'doctors', $2, $3::jsonb)`,
            [normalizedPhone, newDoctor.rows[0].id, JSON.stringify({ full_name, specialty, trust_score: score, auto_status: autoStatus })]
        );

        await client.query('COMMIT');

        try {
            if (autoStatus === 'verified') {
                await sendWhatsAppTemplate(phone, 'bolamu_bienvenue_medecin', [full_name, memberCode]);
            } else {
                await sendWhatsAppTemplate(phone, 'bolamu_inscription_medecin_pending', [full_name, score.toString()]);
            }
        } catch (e) { console.warn('[WhatsApp] Envoi bienvenue médecin échoué (non bloquant):', e.message); }

        return res.status(201).json({
            success: true,
            message: autoStatus === 'verified' ? '✅ Compte validé automatiquement !' : '📋 Inscription reçue. Vérification sous 24h.',
            data: { phone: newDoctor.rows[0].phone, full_name: newDoctor.rows[0].full_name, status: newDoctor.rows[0].status, member_code: newDoctor.rows[0].member_code, trust_score: newDoctor.rows[0].trust_score, auto_validated: autoStatus === 'verified' }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[registerDoctor]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur : ' + error.message });
    } finally {
        client.release();
    }
}

async function getDoctors(req, res) {
    const { specialty, city, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        const conditions = [`d.is_active = TRUE`, `d.status = 'verified'`];
        const params = [];
        if (specialty) { params.push(`%${specialty}%`); conditions.push(`d.specialty ILIKE $${params.length}`); }
        if (city) { params.push(`%${city}%`); conditions.push(`d.city ILIKE $${params.length}`); }
        const whereClause = conditions.join(' AND ');
        params.push(parseInt(limit));
        params.push(offset);
        const result = await pool.query(
            `SELECT d.id, d.full_name, d.specialty, d.city, d.neighborhood, d.bio, d.availability_schedule, d.total_consultations, d.member_code,
                    u.etablissement_nom, u.etablissement_adresse, u.etablissement_ville
             FROM doctors d
             LEFT JOIN users u ON u.phone = d.phone
             WHERE ${whereClause} ORDER BY d.total_consultations DESC, d.created_at ASC
             LIMIT $${params.length - 1} OFFSET $${params.length}`, params
        );
        const countResult = await pool.query(`SELECT COUNT(*) FROM doctors d WHERE ${whereClause}`, params.slice(0, params.length - 2));
        return res.json({ success: true, data: { doctors: result.rows, pagination: { total: parseInt(countResult.rows[0].count), page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)) } } });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

async function updateDoctorStatus(req, res) {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!['verified', 'rejected', 'suspended', 'pending'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    try {
        const result = await pool.query(`UPDATE doctors SET status = $1, is_active = $2 WHERE id = $3 RETURNING *`, [status, status === 'verified', id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Médecin introuvable.' });
        const doc = result.rows[0];
        try {
            const templateMap = {
                verified:  ['bolamu_medecin_valide',   [doc.full_name, doc.member_code]],
                rejected:  ['bolamu_medecin_rejete',   [reason || 'Dossier incomplet']],
                suspended: ['bolamu_compte_suspendu',  [reason || 'Activité suspecte']]
            };
            if (templateMap[status]) {
                await sendWhatsAppTemplate(doc.phone, templateMap[status][0], templateMap[status][1]);
            }
        } catch (e) {
            logger.error('[updateDoctorStatus] WhatsApp error:', e.message);
        }
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ($1, $2, 'doctors', $3, $4::jsonb)`,
            [`doctor.status_${status}`, doc.phone, parseInt(id), JSON.stringify({ reason })]
        ).catch((err) => logger.error('[updateDoctorStatus] Audit log error:', err.message));
        return res.json({ success: true, message: `Statut mis à jour : ${status}`, data: doc });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

async function getDoctorProfile(req, res) {
    const phone = normalizePhone(req.query.phone || '');
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis.' });
    
    try {
        const result = await pool.query(
            `SELECT d.id, d.phone, d.full_name, d.specialty, d.city, d.neighborhood,
                    d.bio, d.availability_schedule, d.total_consultations, d.member_code,
                    d.trust_score, d.status, d.is_active, d.document_url,
                    d.momo_number, d.registration_number, d.created_at,
                    u.validated_at
             FROM doctors d
             LEFT JOIN users u ON u.phone = d.phone
             WHERE d.phone = $1`,
            [phone]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Médecin introuvable.' });
        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── GÉNÉRER QR CODE POUR UN PATIENT (côté médecin) ─────────────────────────────
async function generatePatientQRCode(req, res) {
    const phone = normalizePhone(req.params.phone || '');
    const doctorPhone = req.user.phone;
    
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Numéro de téléphone du patient requis.' });
    }
    
    try {
        // Vérifier que le patient existe et a un abonnement actif
        const patientResult = await pool.query(
            `SELECT u.phone, u.full_name, u.role, s.id as subscription_id, s.plan, s.expires_at
             FROM users u
             LEFT JOIN subscriptions s ON s.patient_phone = u.phone AND s.status = 'active' AND s.expires_at >= NOW()
             WHERE u.phone = $1 AND u.role = 'patient'`,
            [phone]
        );
        
        if (patientResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient introuvable.' });
        }
        
        const patient = patientResult.rows[0];
        
        if (!patient.subscription_id) {
            return res.status(403).json({ success: false, message: 'Le patient n\'a pas d\'abonnement actif.' });
        }
        
        // Générer le token QR (15 minutes)
        const crypto = require('crypto');
        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        
        // Stocker le token QR
        await pool.query(
            `INSERT INTO qr_tokens (user_phone, token, expires_at, generated_by) 
             VALUES ($1, $2, $3, $4)`,
            [phone, token, expiresAt, doctorPhone]
        );
        
        // Audit log
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('QR_GENERATED_BY_DOCTOR', $1, 'qr_tokens', NULL, $2::jsonb)`,
            [doctorPhone, JSON.stringify({ patient_phone: phone, subscription_id: patient.subscription_id, expires_at: expiresAt })]
        ).catch((err) => logger.error('[generatePatientQRCode] Audit log error:', err.message));
        
        return res.json({
            success: true,
            data: {
                qr_token: token,
                expires_at: expiresAt.toISOString(),
                expires_in_minutes: 15,
                patient: {
                    phone: patient.phone,
                    full_name: patient.full_name,
                    subscription_id: patient.subscription_id,
                    plan: patient.plan
                }
            }
        });
        
    } catch (error) {
        console.error('[generatePatientQRCode]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── CRÉER UN CRÉNEAU HORAIRE (POST /api/v1/doctor/slots) ───────────────────────
async function createTimeSlot(req, res) {
    const doctorPhone = req.user.phone;
    const { date, heure_debut, heure_fin } = req.body;

    const dateParam = date;
    const startParam = heure_debut;
    const endParam = heure_fin;

    if (!dateParam || !startParam || !endParam) {
        return res.status(400).json({ success: false, message: 'Champs requis : date, heure_debut, heure_fin.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO time_slots (doctor_phone, date, heure_debut, heure_fin, is_available)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING *`,
            [doctorPhone, dateParam, startParam, endParam]
        );

        // Synchroniser avec doctor_availabilities
        const dayOfWeekMap = {
            0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6
        };
        const dayOfWeek = dayOfWeekMap[new Date(dateParam).getDay()];
        if (dayOfWeek !== undefined) {
            await pool.query(
                `INSERT INTO doctor_availabilities
                 (doctor_id, day_of_week, start_time, end_time, slot_duration)
                 SELECT id, $1, $2, $3, 30
                 FROM users WHERE phone = $4
                 ON CONFLICT (doctor_id, day_of_week)
                 DO UPDATE SET start_time = $2, end_time = $3`,
                [dayOfWeek, startParam, endParam, doctorPhone]
            ).catch((err) => logger.error('[createTimeSlot] Availability error:', err.message));
        }

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('timeslot.created', $1, 'time_slots', $2, $3::jsonb)`,
            [doctorPhone, result.rows[0].id, JSON.stringify({ date: dateParam, heure_debut: startParam, heure_fin: endParam })]
        ).catch((err) => logger.error('[createTimeSlot] Audit log error:', err.message));

        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[createTimeSlot]', error.message);
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Ce créneau existe déjà.' });
        }
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── LISTER CRÉNEAUX D'UN JOUR (GET /api/v1/doctor/slots?date=YYYY-MM-DD) ─────────
async function getTimeSlots(req, res) {
    const doctorPhone = req.user.phone;
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ success: false, message: 'Paramètre date requis (YYYY-MM-DD).' });
    }

    try {
        const result = await pool.query(
            `SELECT * FROM time_slots
             WHERE doctor_phone = $1 AND date = $2
             ORDER BY heure_debut ASC`,
            [doctorPhone, date]
        );

        return res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error('[getTimeSlots]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── MODIFIER DISPONIBILITÉ CRÉNEAU (PATCH /api/v1/doctor/slots/:id) ───────────────
async function updateTimeSlot(req, res) {
    const doctorPhone = req.user.phone;
    const { id } = req.params;
    const { is_available } = req.body;

    if (typeof is_available !== 'boolean') {
        return res.status(400).json({ success: false, message: 'Champ is_required requis (boolean).' });
    }

    try {
        const result = await pool.query(
            `UPDATE time_slots SET is_available = $1, updated_at = NOW()
             WHERE id = $2 AND doctor_phone = $3
             RETURNING *`,
            [is_available, id, doctorPhone]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Créneau introuvable.' });
        }

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('timeslot.updated', $1, 'time_slots', $2, $3::jsonb)`,
            [doctorPhone, id, JSON.stringify({ is_available })]
        ).catch((err) => logger.error('[updateTimeSlot] Audit log error:', err.message));

        return res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('[updateTimeSlot]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── MODIFIER LE PROFIL MÉDECIN (PATCH /api/v1/doctor/profile) ───────────────────────
async function updateDoctorProfile(req, res) {
    const doctorPhone = req.user.phone;
    const { full_name, specialty, city, neighborhood, bio, availability_schedule, telephone_cabinet, photo } = req.body;

    // Champs modifiables : nom, prenom, specialite, telephone_cabinet, bio, photo (URL Cloudinary)
    // Champs NON modifiables : phone (identifiant), is_active, role, created_at

    try {
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (full_name) {
            updates.push(`full_name = $${paramCount++}`);
            values.push(full_name);
        }
        if (specialty) {
            updates.push(`specialty = $${paramCount++}`);
            values.push(specialty);
        }
        if (city) {
            updates.push(`city = $${paramCount++}`);
            values.push(city);
        }
        if (neighborhood !== undefined) {
            updates.push(`neighborhood = $${paramCount++}`);
            values.push(neighborhood || null);
        }
        if (bio !== undefined) {
            updates.push(`bio = $${paramCount++}`);
            values.push(bio || null);
        }
        if (availability_schedule !== undefined) {
            updates.push(`availability_schedule = $${paramCount++}`);
            values.push(availability_schedule || null);
        }
        if (telephone_cabinet !== undefined) {
            updates.push(`telephone_cabinet = $${paramCount++}`);
            values.push(telephone_cabinet || null);
        }
        if (photo !== undefined) {
            updates.push(`photo = $${paramCount++}`);
            values.push(photo || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'Aucun champ à modifier.' });
        }

        updates.push(`updated_at = NOW()`);
        values.push(doctorPhone);

        const query = `UPDATE doctors SET ${updates.join(', ')} WHERE phone = $${paramCount} RETURNING *`;
        const result = await pool.query(query, values);

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Médecin introuvable.' });
        }

        // Mettre à jour aussi la table users pour full_name
        if (full_name) {
            await pool.query(`UPDATE users SET full_name = $1 WHERE phone = $2`, [full_name, doctorPhone]);
        }

        // Audit log
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('doctor.profile_updated', $1, 'doctors', $2, $3::jsonb)`,
            [doctorPhone, result.rows[0].id, JSON.stringify({ updated_fields: Object.keys(req.body) })]
        ).catch((err) => logger.error('[updateDoctorProfile] Audit log error:', err.message));

        return res.json({ success: true, message: 'Profil mis à jour avec succès.', data: result.rows[0] });

    } catch (error) {
        console.error('[updateDoctorProfile]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

async function deleteTimeSlot(req, res) {
    const doctorPhone = req.user.phone;
    const { id } = req.params;

    try {
        // Vérifier ownership — le créneau doit appartenir au médecin connecté
        const slot = await pool.query(
            `SELECT id, date, heure_debut, heure_fin FROM time_slots WHERE id = $1 AND doctor_phone = $2`,
            [id, doctorPhone]
        );
        if (!slot.rows.length) {
            return res.status(404).json({ success: false, message: 'Créneau introuvable.' });
        }
        const { date, heure_debut, heure_fin } = slot.rows[0];

        // Bloquer si un RDV actif existe sur ce créneau (match par date + heure + médecin)
        const conflict = await pool.query(
            `SELECT a.id FROM appointments a
             JOIN doctors d ON d.id = a.doctor_id
             WHERE d.phone = $1
               AND a.appointment_date = $2
               AND a.appointment_time = $3
               AND a.status NOT IN ('annule', 'absent')`,
            [doctorPhone, date, heure_debut]
        );
        if (conflict.rows.length) {
            return res.status(409).json({
                success: false,
                message: 'Impossible de supprimer ce créneau : un rendez-vous actif y est associé.'
            });
        }

        await pool.query(`DELETE FROM time_slots WHERE id = $1 AND doctor_phone = $2`, [id, doctorPhone]);

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('timeslot.deleted', $1, 'time_slots', $2, $3::jsonb)`,
            [doctorPhone, id, JSON.stringify({ date, heure_debut, heure_fin })]
        ).catch((err) => logger.error('[deleteTimeSlot] Audit log error:', err.message));

        return res.json({ success: true, message: 'Créneau supprimé.' });
    } catch (error) {
        console.error('[deleteTimeSlot]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = { registerDoctor, getDoctors, updateDoctorStatus, getDoctorProfile, generatePatientQRCode, createTimeSlot, getTimeSlots, updateTimeSlot, updateDoctorProfile, deleteTimeSlot };