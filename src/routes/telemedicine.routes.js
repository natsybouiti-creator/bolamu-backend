const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../../middleware/auth.middleware');

// ─── GET /telemedicine/room/:appointmentId ────────────────────────────────────
router.get('/room/:appointmentId', authMiddleware, async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { phone } = req.user;

    const apptRes = await pool.query(
      `SELECT a.*, d.phone as doctor_phone, d.full_name as doctor_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = $1`,
      [appointmentId]
    );

    if (!apptRes.rows.length) {
      return res.status(404).json({ success: false, message: 'RDV introuvable.' });
    }

    const appt = apptRes.rows[0];

    if (appt.patient_phone !== phone && appt.doctor_phone !== phone) {
      return res.status(403).json({ success: false, message: 'Accès non autorisé à ce RDV.' });
    }

    const roomName = `bolamu-${appt.session_code}-${appointmentId}`;
    const jitsiUrl = `https://meet.jit.si/${roomName}`;
    const role = appt.doctor_phone === phone ? 'doctor' : 'patient';
    const displayName = role === 'doctor' ? appt.doctor_name : appt.patient_phone;

    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id)
       VALUES ('telemedicine_joined', $1, 'appointments', $2)`,
      [phone, appointmentId]
    ).catch(() => {});

    res.json({
      success: true,
      data: {
        room_name: roomName,
        jitsi_url: jitsiUrl,
        session_code: appt.session_code,
        appointment_date: appt.appointment_date,
        appointment_time: appt.appointment_time,
        doctor_name: appt.doctor_name,
        patient_phone: appt.patient_phone,
        role,
        display_name: displayName
      }
    });

  } catch (e) {
    console.error('[telemedicine/room]', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ─── POST /telemedicine/start ─────────────────────────────────────────────────
router.post('/start', authMiddleware, async (req, res) => {
  try {
    const { appointment_id } = req.body;
    const { phone } = req.user;

    const apptRes = await pool.query(
      `SELECT a.*, d.phone as doctor_phone, d.full_name as doctor_name
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
       WHERE a.id = $1`,
      [appointment_id]
    );

    if (!apptRes.rows.length) {
      return res.status(404).json({ success: false, message: 'RDV introuvable.' });
    }

    const appt = apptRes.rows[0];

    if (appt.doctor_phone !== phone) {
      return res.status(403).json({ success: false, message: 'Seul le médecin peut démarrer la session.' });
    }

    const roomName = `bolamu-${appt.session_code}-${appointment_id}`;
    const jitsiUrl = `https://meet.jit.si/${roomName}`;

    await pool.query(
      `UPDATE appointments SET status = 'en_cours', opened_at = NOW() WHERE id = $1`,
      [appointment_id]
    ).catch(() => {});

    try {
      const { sendBolamuSms } = require('../services/sms.service');
      await sendBolamuSms(
        appt.patient_phone,
        `Bolamu : Dr. ${appt.doctor_name} vous attend en téléconsultation. Connectez-vous sur bolamu-backend.onrender.com — Code : ${appt.session_code}`
      );
    } catch (e) {
      console.log('SMS télémédecine non envoyé:', e.message);
    }

    res.json({
      success: true,
      message: 'Session démarrée — patient notifié',
      jitsi_url: jitsiUrl,
      room_name: roomName
    });

  } catch (e) {
    console.error('[telemedicine/start]', e.message);
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;