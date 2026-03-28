const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');
const authMiddleware = require('../../middleware/auth.middleware');

// ─── CRÉNEAUX DISPONIBLES (public) ───────────────────────────────────────────
router.get('/slots/:doctor_id', async (req, res) => {
    const { doctor_id } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date requise" });
    try {
        const docResult = await pool.query(`SELECT availability_schedule FROM doctors WHERE id = $1`, [doctor_id]);
        if (!docResult.rows.length) return res.status(404).json({ error: "Médecin introuvable" });
        const schedule = docResult.rows[0].availability_schedule;
        const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
        const jour = jours[new Date(date).getDay()];
        const creneaux = schedule[jour] || [];
        const prisResult = await pool.query(
            `SELECT appointment_time FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status IN ('confirme', 'en_attente')`,
            [doctor_id, date]
        );
        const pris = prisResult.rows.map(r => r.appointment_time.slice(0,5));
        const libres = creneaux.filter(c => !pris.includes(c));
        res.json({ success: true, date, jour, slots: libres, pris });
    } catch(err) {
        console.error(err);
        res.status(500).json({ error: "Erreur lors de la récupération des créneaux" });
    }
});

// ─── RÉSERVER UN RDV ─────────────────────────────────────────────────────────
router.post('/book', authMiddleware, async (req, res) => {
    const { patient_phone, doctor_id, date, time } = req.body;
    try {
        const conflict = await pool.query(
            `SELECT id FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3 AND status IN ('confirme', 'en_attente')`,
            [doctor_id, date, time]
        );
        if (conflict.rows.length > 0) {
            return res.status(409).json({ success: false, message: "Ce créneau est déjà pris." });
        }
        const session_code = Math.floor(1000 + Math.random() * 9000).toString();
        const result = await pool.query(
            `INSERT INTO appointments (patient_phone, doctor_id, appointment_date, appointment_time, session_code, status)
             VALUES ($1, $2, $3, $4, $5, 'confirme') RETURNING *`,
            [patient_phone, doctor_id, date, time, session_code]
        );
        try {
            await sendBolamuSms(patient_phone, `Bolamu : Votre RDV est confirme. Code de session : ${session_code}`);
        } catch (smsErr) {
            console.log("⚠️ SMS non envoyé, RDV enregistré.");
        }
        res.status(201).json({ success: true, message: "RDV enregistre !", appointment: result.rows[0] });
    } catch (err) {
        console.error("❌ ERREUR SQL :", err);
        res.status(500).json({ error: "Erreur réservation : " + err.message });
    }
});

// ─── RDV D'UN MÉDECIN PAR PHONE (dashboard médecin) ──────────────────────────
router.get('/doctor/:phone', authMiddleware, async (req, res) => {
    const { phone } = req.params;
    try {
        // Trouver le doctor_id depuis le phone
        const doc = await pool.query(`SELECT id FROM doctors WHERE phone = $1`, [phone]);
        if (!doc.rows.length) {
            return res.json({ success: true, data: [] });
        }
        const doctor_id = doc.rows[0].id;

        const result = await pool.query(
            `SELECT a.*, 
                    a.appointment_date as date,
                    a.appointment_time as time
             FROM appointments a
             WHERE a.doctor_id = $1
             ORDER BY a.appointment_date ASC, a.appointment_time ASC`,
            [doctor_id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur récupération" });
    }
});

// ─── RDV D'UN PATIENT ────────────────────────────────────────────────────────
router.get('/patient/:phone', authMiddleware, async (req, res) => {
    const { phone } = req.params;
    try {
        const result = await pool.query(
            `SELECT a.*, 
                    a.appointment_date as date,
                    a.appointment_time as time,
                    d.full_name as doctor_name, 
                    d.specialty
             FROM appointments a
             JOIN doctors d ON d.id = a.doctor_id
             WHERE a.patient_phone = $1
             ORDER BY a.appointment_date ASC`,
            [phone]
        );
        res.json({ success: true, appointments: result.rows });
    } catch (err) {
        res.status(500).json({ error: "Erreur récupération" });
    }
});

// ─── OUVRIR UNE FICHE (mesure début consultation) ────────────────────────────
router.post('/:id/open', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE appointments SET opened_at = NOW() WHERE id = $1`, [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Erreur" });
    }
});

// ─── VALIDER UNE CONSULTATION (anti-fraude complet) ──────────────────────────
router.post('/:id/validate', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { session_code, consultation_duration_minutes } = req.body;
    const doctorPhone = req.user?.phone;

    try {
        const rdv = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [id]);
        if (!rdv.rows.length) return res.status(404).json({ success: false, message: 'RDV introuvable.' });

        const appt = rdv.rows[0];

        // Vérifier code session
        if (appt.session_code !== session_code) {
            return res.status(403).json({ success: false, message: 'Code session invalide.' });
        }

        // Déjà terminé ?
        if (appt.status === 'termine' || appt.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Ce RDV est déjà validé.' });
        }

        const now = new Date();
        const rdvDateTime = new Date(`${appt.appointment_date}T${appt.appointment_time}`);
        const delayMinutes = Math.round((now - rdvDateTime) / 60000);

        // SIGNAL : validation trop tôt (plus de 30 min avant le RDV)
        if (delayMinutes < -30) {
            await pool.query(
                `INSERT INTO fraud_signals (signal_type, severity, actor_phone, appointment_id, details)
                 VALUES ('early_validation', 'high', $1, $2, $3)`,
                [doctorPhone, id, JSON.stringify({ rdv_time: rdvDateTime, validated_at: now, delay_minutes: delayMinutes })]
            ).catch(() => {});
            return res.status(400).json({
                success: false,
                message: `Validation impossible : le RDV est prévu dans ${Math.abs(delayMinutes)} minutes.`
            });
        }

        // SIGNAL : consultation trop courte (< 5 min)
        if (consultation_duration_minutes !== undefined && consultation_duration_minutes < 5) {
            await pool.query(
                `INSERT INTO fraud_signals (signal_type, severity, actor_phone, appointment_id, details)
                 VALUES ('short_consultation', 'medium', $1, $2, $3)`,
                [doctorPhone, id, JSON.stringify({ duration_minutes: consultation_duration_minutes })]
            ).catch(() => {});
        }

        // SIGNAL : même patient, même médecin, même jour — RDV répétitifs
        const repeats = await pool.query(
            `SELECT COUNT(*) FROM appointments
             WHERE patient_phone = $1 AND doctor_id = $2 AND appointment_date = $3 AND id != $4`,
            [appt.patient_phone, appt.doctor_id, appt.appointment_date, id]
        );
        if (parseInt(repeats.rows[0].count) >= 2) {
            await pool.query(
                `INSERT INTO fraud_signals (signal_type, severity, actor_phone, appointment_id, details)
                 VALUES ('repeated_rdv', 'medium', $1, $2, $3)`,
                [appt.patient_phone, id, JSON.stringify({ count_same_day: parseInt(repeats.rows[0].count) + 1 })]
            ).catch(() => {});
        }

        // Marquer terminé
        await pool.query(
            `UPDATE appointments
             SET status = 'termine',
                 validated_at = NOW(),
                 validation_delay_minutes = $1,
                 consultation_duration_minutes = $2
             WHERE id = $3`,
            [delayMinutes, consultation_duration_minutes || null, id]
        );

        // Audit log
        await pool.query(
            `INSERT INTO audit_log (action, actor_phone, details) VALUES ($1, $2, $3)`,
            ['appointment_validated', doctorPhone, JSON.stringify({ appointment_id: id, patient_phone: appt.patient_phone })]
        ).catch(() => {});

        res.json({ success: true, message: 'Consultation validée avec succès.', data: { appointment_id: id, delay_minutes: delayMinutes } });

    } catch (err) {
        console.error('[validate]', err.message);
        res.status(500).json({ error: "Erreur validation" });
    }
});

// ─── ANCIENNE ROUTE VALIDATE-SESSION (compatibilité) ─────────────────────────
router.post('/validate-session', authMiddleware, async (req, res) => {
    const { appointment_id, session_code } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM appointments WHERE id = $1 AND session_code = $2`, [appointment_id, session_code]);
        if (!result.rows.length) return res.status(400).json({ success: false, message: "Code invalide." });
        await pool.query(`UPDATE appointments SET status = 'termine' WHERE id = $1`, [appointment_id]);
        res.json({ success: true, message: "Consultation terminee !" });
    } catch (err) {
        res.status(500).json({ error: "Erreur validation" });
    }
});

module.exports = router;