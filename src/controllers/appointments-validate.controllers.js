const pool = require('../config/db');

// ─── OUVRIR UNE FICHE (mesure le début de consultation) ──────────────────────
async function openAppointment(req, res) {
    const { id } = req.params;

    try {
        await pool.query(
            `UPDATE appointments SET opened_at = NOW() WHERE id = $1`,
            [id]
        );
        return res.json({ success: true });
    } catch (error) {
        console.error('[openAppointment] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── VALIDER UNE CONSULTATION (avec anti-fraude complet) ─────────────────────
async function validateAppointment(req, res) {
    const { id } = req.params;
    const { session_code, consultation_duration_minutes } = req.body;
    const doctorPhone = req.user?.phone;

    try {
        // 1. Récupérer le RDV — colonnes compatibles avec le schéma Bolamu
        const rdv = await pool.query(
            `SELECT * FROM appointments WHERE id = $1`,
            [id]
        );

        if (rdv.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'RDV introuvable.' });
        }

        const appt = rdv.rows[0];

        // 2. Vérifier le code session (4 chiffres)
        const storedCode = (appt.session_code || '').toString();
        if (storedCode && storedCode !== session_code.toString()) {
            return res.status(403).json({ success: false, message: 'Code session invalide.' });
        }

        // 3. Vérifier que le RDV n'est pas déjà terminé
        if (['termine', 'completed', 'done'].includes(appt.status)) {
            return res.status(400).json({ success: false, message: 'Ce RDV est déjà validé.' });
        }

        const now = new Date();
        const rdvDateStr = appt.appointment_date || appt.date;
        const rdvTimeStr = appt.appointment_time || appt.time;
        const delayMinutes = rdvDateStr && rdvTimeStr
            ? Math.round((now - new Date(`${rdvDateStr}T${rdvTimeStr}`)) / 60000)
            : 0;

        // ── SIGNAL ANTI-FRAUDE 1 : validation trop tôt ───────────────────────
        if (delayMinutes < -5) {
            await pool.query(
                `INSERT INTO fraud_signals (signal_type, severity, actor_phone, appointment_id, details)
                 VALUES ('early_validation', 'high', $1, $2, $3)`,
                [doctorPhone, id, JSON.stringify({ delay_minutes: delayMinutes })]
            ).catch(() => {});

            if (delayMinutes < -30) {
                return res.status(400).json({
                    success: false,
                    message: `Validation impossible : le RDV est prévu dans ${Math.abs(delayMinutes)} minutes.`
                });
            }
        }

        // ── SIGNAL ANTI-FRAUDE 2 : consultation trop courte ──────────────────
        if (consultation_duration_minutes !== undefined && Number(consultation_duration_minutes) < 5) {
            await pool.query(
                `INSERT INTO fraud_signals (signal_type, severity, actor_phone, appointment_id, details)
                 VALUES ('short_consultation', 'medium', $1, $2, $3)`,
                [doctorPhone, id, JSON.stringify({ duration_minutes: consultation_duration_minutes })]
            ).catch(() => {});
        }

        // ── SIGNAL ANTI-FRAUDE 3 : RDV répétitifs même patient/jour ──────────
        const patientPhone = appt.patient_phone;
        const repeats = await pool.query(
            `SELECT COUNT(*) FROM appointments 
             WHERE patient_phone = $1 AND id != $2
               AND (appointment_date = $3 OR date::text = $3)`,
            [patientPhone, id, rdvDateStr]
        ).catch(() => ({ rows: [{ count: 0 }] }));

        if (parseInt(repeats.rows[0].count) >= 2) {
            await pool.query(
                `INSERT INTO fraud_signals (signal_type, severity, actor_phone, appointment_id, details)
                 VALUES ('repeated_rdv', 'medium', $1, $2, $3)`,
                [patientPhone, id, JSON.stringify({ count_same_day: parseInt(repeats.rows[0].count) + 1 })]
            ).catch(() => {});
        }

        // ── ALERTE AUTO si 3+ signaux HIGH en 30 jours ───────────────────────
        if (doctorPhone) {
            const highSignals = await pool.query(
                `SELECT COUNT(*) FROM fraud_signals 
                 WHERE actor_phone = $1 AND severity = 'high' 
                   AND created_at > NOW() - INTERVAL '30 days'`,
                [doctorPhone]
            ).catch(() => ({ rows: [{ count: 0 }] }));

            if (parseInt(highSignals.rows[0].count) >= 3) {
                await pool.query(
                    `INSERT INTO audit_log (action, actor, details) VALUES ($1, $2, $3)`,
                    ['auto_suspension_triggered', doctorPhone,
                     JSON.stringify({ signal_count: parseInt(highSignals.rows[0].count) + 1 })]
                ).catch(() => {});
                console.warn(`⚠️ ALERTE FRAUDE : ${doctorPhone} — ${parseInt(highSignals.rows[0].count) + 1} signaux HIGH`);
            }
        }

        // 4. Marquer le RDV comme terminé
        await pool.query(
            `UPDATE appointments 
             SET status = 'termine',
                 validated_at = NOW(),
                 validation_delay_minutes = $1,
                 consultation_duration_minutes = $2
             WHERE id = $3`,
            [delayMinutes, consultation_duration_minutes || null, id]
        );

        // Audit
        await pool.query(
            `INSERT INTO audit_log (action, actor, details) VALUES ($1, $2, $3)`,
            ['appointment_validated', doctorPhone || 'unknown', JSON.stringify({
                appointment_id: id, patient_phone: patientPhone, delay_minutes: delayMinutes
            })]
        ).catch(() => {});

        console.log(`✅ Consultation validée — RDV ${id} — délai: ${delayMinutes} min`);

        return res.json({
            success: true,
            message: 'Consultation validée avec succès.',
            data: { appointment_id: id, delay_minutes: delayMinutes }
        });

    } catch (error) {
        console.error('[validateAppointment] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = { openAppointment, validateAppointment };