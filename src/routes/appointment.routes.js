const express = require('express');
const router = express.Router();
const path = require('path');
const pool = require('../config/db');

// --- IMPORTS SÉCURISÉS ---
const authPath = path.join(__dirname, '..', '..', 'middleware', 'auth.middleware.js');
const authImport = require(authPath);
const authMiddleware = (typeof authImport === 'function') ? authImport : (req, res, next) => next();

const smsPath = path.join(__dirname, '..', 'services', 'sms.service.js');
let sendBolamuSms;
try {
    const smsService = require(smsPath);
    sendBolamuSms = smsService.sendBolamuSms;
} catch (e) {
    sendBolamuSms = async (p, m) => console.log(`[SMS] ${p}: ${m}`);
}

// 1. Créneaux disponibles
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
        res.json({ success: true, slots: libres });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Réserver un RDV
router.post('/book', authMiddleware, async (req, res) => {
    const { patient_phone, doctor_id, date, time } = req.body;
    try {
        const session_code = Math.floor(1000 + Math.random() * 9000).toString();
        const result = await pool.query(
            `INSERT INTO appointments (patient_phone, doctor_id, appointment_date, appointment_time, session_code, status)
             VALUES ($1, $2, $3, $4, $5, 'confirme') RETURNING *`,
            [patient_phone, doctor_id, date, time, session_code]
        );
        await sendBolamuSms(patient_phone, `Bolamu : RDV confirme. Code : ${session_code}`);
        res.status(201).json({ success: true, appointment: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. RDV d'un médecin
router.get('/doctor/:phone', authMiddleware, async (req, res) => {
    const { phone } = req.params;
    try {
        const doc = await pool.query(`SELECT id FROM doctors WHERE phone = $1`, [phone]);
        if (!doc.rows.length) return res.json({ success: true, data: [] });
        const result = await pool.query(
            `SELECT * FROM appointments WHERE doctor_id = $1 ORDER BY appointment_date ASC`,
            [doc.rows[0].id]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ error: "Erreur" });
    }
});

// 4. Valider une consultation (Anti-fraude)
router.post('/:id/validate', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { session_code } = req.body;
    try {
        const rdv = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [id]);
        if (!rdv.rows.length || rdv.rows[0].session_code !== session_code) {
            return res.status(403).json({ success: false, message: 'Code invalide.' });
        }
        await pool.query(`UPDATE appointments SET status = 'termine', validated_at = NOW() WHERE id = $1`, [id]);
        res.json({ success: true, message: 'Validé.' });
    } catch (err) {
        res.status(500).json({ error: "Erreur" });
    }
});

module.exports = router;