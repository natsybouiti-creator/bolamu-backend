const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');
const authMiddleware = require('../middleware/auth.middleware');

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
            `INSERT INTO appointments (patient_phone, doctor_id, appointment_date, appointment_time, session_code, status) VALUES ($1, $2, $3, $4, $5, 'confirme') RETURNING *`,
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

router.get('/doctor/:doctor_id', authMiddleware, async (req, res) => {
    const { doctor_id } = req.params;
    try {
        const result = await pool.query(`SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY appointment_date ASC`, [doctor_id]);
        res.json({ success: true, appointments: result.rows });
    } catch (err) {
        res.status(500).json({ error: "Erreur récupération" });
    }
});

router.get('/patient/:phone', authMiddleware, async (req, res) => {
    const { phone } = req.params;
    try {
        const result = await pool.query(
            `SELECT a.*, d.full_name as doctor_name, d.specialty FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE a.patient_phone = $1 ORDER BY a.appointment_date ASC`,
            [phone]
        );
        res.json({ success: true, appointments: result.rows });
    } catch (err) {
        res.status(500).json({ error: "Erreur récupération" });
    }
});

router.post('/validate-session', authMiddleware, async (req, res) => {
    const { appointment_id, session_code } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM appointments WHERE id = $1 AND session_code = $2`, [appointment_id, session_code]);
        if (result.rows.length === 0) return res.status(400).json({ success: false, message: "Code invalide." });
        await pool.query(`UPDATE appointments SET status = 'termine' WHERE id = $1`, [appointment_id]);
        res.json({ success: true, message: "Consultation terminee !" });
    } catch (err) {
        res.status(500).json({ error: "Erreur validation" });
    }
});

module.exports = router;