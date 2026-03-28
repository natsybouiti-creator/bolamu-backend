const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { sendBolamuSms } = require('../services/sms.service');
const authMiddleware = require('../middleware/auth.middleware');

// 1. Créneaux disponibles — PUBLIC (pas de token requis)
router.get('/slots/:doctor_id', async (req, res) => {
    const { doctor_id } = req.params;
    const { date } = req.query;

    if (!date) return res.status(400).json({ error: "Date requise" });

    try {
        const docResult = await pool.query(
            `SELECT availability_schedule FROM doctors WHERE id = $1`,
            [doctor_id]
        );
        if (!docResult.rows.length) return res.status(404).json({ error: "Médecin introuvable" });

        const schedule = docResult.rows[0].availability_schedule;
        const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
        const jour = jours[new Date(date).getDay()];
        const creneaux = schedule[jour] || [];

        const prisResult = await pool.query(
            `SELECT appointment_time FROM appointments
             WHERE doctor_id = $1 AND appointment_date = $2
             AND status IN ('confirme', 'en_attente')`,
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

// 2. Prendre un RDV — PROTÉGÉ
router.post('/book', authMiddleware, async (req, res) => {
    const { patient_phone, doctor_id, date, time } = req.body;

    try {
        const conflict = await pool.query(
            `SELECT id FROM appointments 
             WHERE doctor_id = $1 AND appointment_date = $2 AND appointment_time = $3
             AND status IN ('confirme', 'en_attente')`,
            [doctor_id, date, time]
        );

        if (conflict.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Ce créneau est déjà pris. Veuillez choisir un autre horaire."
            });
        }

        const session_code = Math.floor(1000 + Math.random() * 9000).toString();

        const result = await pool.query(
            `INSERT INTO appointments 
             (patient_phone, doctor_id, appointment_date, appointment_time, session_code, status) 
             VALUES ($1, $2, $3, $4, $5, 'confirme') RETURNING *`,
            [patient_phone, doctor_id, date, time, session_code]
        );

        try {
            const messageSms = `Bolamu : Votre RDV est confirme. Code de session : ${session_code}`;
            await sendBolamuSms(patient_phone, messageSms);
        } catch (smsErr) {
            console.log("⚠️ SMS non envoyé, mais RDV bien enregistré dans la base.");
        }

        res.status(201).json({
            success: true,
            message: "RDV enregistre avec succes !",
            appointment: result.rows[0]
        });

    } catch (err) {