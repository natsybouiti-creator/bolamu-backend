const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { normalizePhone } = require('../utils/phone');

// --- SERVICE DE NOTIFICATION UNIFIÉ ---
const { notify } = require('../services/notification.service');
const { buildWameLink } = require('../services/wame.service');
const { sendAutoMessage } = require('../services/whatsapp.service');
const { awardZora, resolveConsultationActionType } = require('../services/zora.service');

// Middleware pour restreindre aux médecins (même convention que lab.routes.js /
// consultation-report.routes.js) — évite qu'un compte authentifié quelconque
// (patient inclus) ne déclenche la validation d'un RDV tiers et son crédit Zora
// associé en connaissant seulement l'id et le session_code.
const doctorOnly = (req, res, next) => {
    if (req.user?.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
    }
    next();
};

// --- ROUTES ---

// 1. Créneaux (Public)
router.get('/slots/:doctor_id', async (req, res) => {
    const { doctor_id } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELD', message: 'Date requise.' } });
    try {
        // 1. Récupère le jour de la semaine de la date demandée
        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dateObj.getDay(); // 0=Dim, 1=Lun...

        // 2. Récupère les disponibilités du médecin pour ce jour
        const availResult = await pool.query(
            `SELECT start_time, end_time, slot_duration 
             FROM doctor_availabilities 
             WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = true`,
            [doctor_id, dayOfWeek]
        );

        if (!availResult.rows.length) {
            return res.json({ success: true, slots: [], pris: [], message: 'Aucune disponibilité ce jour' });
        }

        // 3. Génère les créneaux entre start_time et end_time par tranches de slot_duration minutes
        function generateSlots(start, end, duration) {
            const slots = [];
            let [h, m] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            while (h < eh || (h === eh && m < em)) {
                slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
                m += duration;
                if (m >= 60) { h += Math.floor(m/60); m = m % 60; }
            }
            return slots;
        }

        const allSlots = [];
        for (const avail of availResult.rows) {
            const slots = generateSlots(avail.start_time, avail.end_time, avail.slot_duration);
            allSlots.push(...slots);
        }

        // 4. Récupère les créneaux déjà pris
        const prisResult = await pool.query(
            `SELECT appointment_time FROM appointments 
             WHERE doctor_id = $1 AND appointment_date = $2 
             AND status NOT IN ('annule', 'refuse')`,
            [doctor_id, date]
        );

        // 5. Filtre les slots pris
        const pris = prisResult.rows.map(r => r.appointment_time.slice(0,5));
        const libres = allSlots.filter(s => !pris.includes(s));

        // 6. Gère agenda_blocks (si table existe)
        let blocksResult = { rows: [] };
        try {
            blocksResult = await pool.query(
                `SELECT block_start, block_end FROM agenda_blocks WHERE doctor_id = $1 AND block_date = $2`,
                [doctor_id, date]
            );
        } catch (blockErr) {
            console.error('[SLOTS] agenda_blocks table error:', blockErr.message);
        }

        // Filtre les créneaux bloqués
        const libresFinal = libres.filter(c => {
            for (const block of blocksResult.rows) {
                if (c >= block.block_start && c < block.block_end) {
                    return false;
                }
            }
            return true;
        });

        const bloques = [];
        for (const block of blocksResult.rows) {
            for (const c of allSlots) {
                if (c >= block.block_start && c < block.block_end && !pris.includes(c) && !bloques.includes(c)) {
                    bloques.push(c);
                }
            }
        }

        const tousPris = [...pris, ...bloques];

        res.json({ success: true, slots: libresFinal, pris: tousPris, jour: date });
    } catch(err) {
        console.error('[SLOTS] Error:', err.message, err.stack);
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Impossible de charger les créneaux.' } });
    }
});

// 2. Réserver (Ligne 33 corrigée : le handler est défini ici directement)
router.post('/book', authMiddleware, async (req, res) => {
    const { patient_phone, doctor_id, date, time, motif } = req.body;
    try {
        // a) Vérifier double booking
        const existingAppointment = await pool.query(
            `SELECT id FROM appointments 
             WHERE doctor_id = $1 
             AND appointment_date = $2 
             AND appointment_time = $3 
             AND status NOT IN ('annule', 'refuse')`,
            [doctor_id, date, time]
        );
        if (existingAppointment.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Ce créneau est déjà réservé' });
        }

        // b) Vérifier agenda_blocks
        const existingBlock = await pool.query(
            `SELECT id FROM agenda_blocks 
             WHERE doctor_id = $1 
             AND block_date = $2 
             AND block_start <= $3 
             AND block_end > $3`,
            [doctor_id, date, time]
        );
        if (existingBlock.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Ce créneau est bloqué par le secrétariat' });
        }

        const session_code = Math.floor(1000 + Math.random() * 9000).toString();
        const result = await pool.query(
            `INSERT INTO appointments (patient_phone, doctor_id, appointment_date, appointment_time, session_code, status, motif)
             VALUES ($1, $2, $3, $4, $5, 'confirme', $6) RETURNING *`,
            [patient_phone, doctor_id, date, time, session_code, motif || null]
        );
        
        // Notifications asynchrones (ne bloquent pas la réponse)
        setImmediate(async () => {
            try {
                const docResult = await pool.query(
                    `SELECT full_name, phone FROM doctors WHERE id = $1`,
                    [doctor_id]
                );
                const doctorName = docResult.rows[0]?.full_name || 'votre médecin';
                const doctorPhone = docResult.rows[0]?.phone;

                const patientRowAppt = await pool.query(
                    `SELECT first_name FROM users WHERE phone = $1`,
                    [patient_phone]
                );
                const patientFirstNameAppt = patientRowAppt.rows[0]?.first_name || patient_phone;

                // Récupérer adresse établissement du médecin
                const userResult = await pool.query(
                    `SELECT etablissement_adresse FROM users WHERE phone = $1`,
                    [doctorPhone]
                );
                const etablissementAdresse = userResult.rows[0]?.etablissement_adresse || 'Bolamu Hub';

                buildWameLink(patient_phone, 'rdv_pris', {
                    prenom: patientFirstNameAppt,
                    medecin: doctorName,
                    date: date,
                    heure: time,
                    clinique: 'Bolamu Hub'
                });

                if (doctorPhone) {
                    buildWameLink(doctorPhone, 'medecin_nouveau_rdv', {
                        patient_nom: patientFirstNameAppt,
                        date: date,
                        heure: time,
                        motif: 'Consultation'
                    });
                }

                await notify(patient_phone, 'rdv_confirme', {
                    doctor_name: doctorName,
                    date: date,
                    heure: time
                });
                if (doctorPhone) {
                    await notify(doctorPhone, 'message_recu', {
                        message: `Nouveau RDV — Patient : ${patient_phone} le ${date} à ${time}`
                    });
                }

                // Notifications WhatsApp templates (non bloquant)
                try {
                    // Patient
                    sendAutoMessage(patient_phone, 'bolamu_rdv_confirme', [
                        patientFirstNameAppt,
                        date,
                        time,
                        doctorName,
                        etablissementAdresse,
                        session_code
                    ]);
                    // Médecin
                    if (doctorPhone) {
                        sendAutoMessage(doctorPhone, 'bolamu_rdv_confirme', [
                            doctorName,
                            date,
                            time,
                            patientFirstNameAppt,
                            etablissementAdresse,
                            session_code
                        ]);
                    }
                } catch (whatsappErr) {
                    console.error('[WHATSAPP RDV]', whatsappErr.message);
                }
            } catch (e) { console.error('[NOTIFY RDV]', e.message); }
        });

        res.status(201).json({ success: true, appointment: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Réservation impossible — réessaie.' } });
    }
});

// 3. RDV Médecin
router.get('/doctor/:phone', authMiddleware, async (req, res) => {
    const phone = normalizePhone(req.params.phone || '');
    const userPhone = normalizePhone(req.user?.phone || '');
    const userRole = req.user?.role;
    const isOwnDoctor = userRole === 'doctor' && userPhone === phone;
    const isAdmin = userRole === 'admin' || userRole === 'content_admin';
    if (!isOwnDoctor && !isAdmin) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Accès refusé.' } });
    }
    const { page = 1, per_page = 20, today } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(per_page);
    try {
        const doc = await pool.query(`SELECT id FROM doctors WHERE phone = $1`, [phone]);
        if (!doc.rows.length) return res.json({ success: true, data: [], pagination: { total: 0, page: parseInt(page), per_page: parseInt(per_page) } });

        const filters = ['a.doctor_id = $1'];
        const queryParams = [doc.rows[0].id];
        if (today === '1') {
            filters.push("a.appointment_date = CURRENT_DATE");
            filters.push("a.status NOT IN ('annule', 'refuse')");
        }
        const whereClause = filters.join(' AND ');
        const perPage = today === '1' ? 100 : parseInt(per_page);
        const off = today === '1' ? 0 : offset;

        const result = await pool.query(
            `SELECT 
                a.*,
                u.full_name as patient_name,
                s.motif as symptomes_motif,
                s.symptomes as symptomes_liste,
                s.duree_symptomes,
                s.intensite,
                s.remarques_patient
             FROM appointments a
             LEFT JOIN users u ON u.phone = a.patient_phone
             LEFT JOIN appointment_symptoms s ON s.appointment_id = a.id
             WHERE ${whereClause}
             ORDER BY a.appointment_date DESC, a.appointment_time DESC
             LIMIT $2 OFFSET $3`,
            [...queryParams, perPage, off]
        );

        const countResult = await pool.query(`SELECT COUNT(*) FROM appointments a WHERE ${whereClause}`, queryParams);
        const total = parseInt(countResult.rows[0].count);
        
        res.json({
            success: true,
            data: result.rows,
            pagination: {
                total: total,
                page: parseInt(page),
                per_page: perPage,
                pages: Math.ceil(total / perPage)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Impossible de charger les rendez-vous.' } });
    }
});

// 4. RDV Patient
router.get('/patient/:phone', authMiddleware, async (req, res) => {
  try {
    const phone = normalizePhone(req.params.phone || '');
    const userPhone = normalizePhone(req.user?.phone || '');
    const userRole = req.user?.role;
    const isOwnPatient = userPhone === phone;
    const isAdmin = userRole === 'admin' || userRole === 'content_admin';
    if (!isOwnPatient && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }
    const result = await pool.query(
      `SELECT a.id, a.patient_phone, a.status, a.session_code,
              a.appointment_date, a.appointment_time, a.created_at,
              d.full_name as doctor_name, d.specialty as doctor_specialty,
              d.phone as doctor_phone
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE a.patient_phone = $1
       ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [phone]
    );
    return res.json({ success: true, appointments: result.rows });
  } catch (error) {
    console.error('[appointments/patient]', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
});

// 5. Validation (Anti-fraude simplifié pour stabilité)
router.post('/:id/validate', authMiddleware, doctorOnly, async (req, res) => {
    const { id } = req.params;
    const { session_code } = req.body;
    try {
        const result = await pool.query(`SELECT session_code, doctor_id FROM appointments WHERE id = $1`, [id]);
        if (!result.rows.length || result.rows[0].session_code !== session_code) {
            return res.status(403).json({ success: false, message: "Code invalide" });
        }
        const userPhone = normalizePhone(req.user?.phone || '');
        const doc = await pool.query(`SELECT id FROM doctors WHERE phone = $1`, [userPhone]);
        const isAssignedDoctor = doc.rows.length > 0 && doc.rows[0].id === result.rows[0].doctor_id;
        if (!isAssignedDoctor) {
            return res.status(403).json({ success: false, message: "Vous n'êtes pas le médecin assigné à ce rendez-vous." });
        }
        await pool.query(`UPDATE appointments SET status = 'termine', validated_at = NOW() WHERE id = $1`, [id]);
        
        // Award Zora points for completed consultation (ou bilan_annuel si le RDV a été
        // planifié avec ce motif — cf. resolveConsultationActionType)
        const appointmentResult = await pool.query(`SELECT patient_phone, motif FROM appointments WHERE id = $1`, [id]);
        if (appointmentResult.rows.length > 0) {
          const patientPhone = appointmentResult.rows[0].patient_phone;
          try {
            await awardZora({
              phone: patientPhone,
              action_type: resolveConsultationActionType(appointmentResult.rows[0].motif),
              proof_class: 'system_event',
              proof_source: 'appointment_system',
              recording_method: null,
              proof_reference: id.toString()
            });
          } catch (zoraError) {
            console.error('[ZORA] Erreur lors du crédit consultation:', zoraError.message);
          }
        }
        
        res.json({ success: true, message: "Consultation validée" });
    } catch (err) {
        res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Erreur lors de la validation.' } });
    }
});

// 5.5. Ouverture consultation (marque RDV en cours)
router.post('/:id/open', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    const appt = await pool.query(`SELECT doctor_id FROM appointments WHERE id = $1`, [id]);
    if (!appt.rows.length)
      return res.status(404).json({ success: false, message: 'RDV introuvable' });

    const userPhone = normalizePhone(req.user?.phone || '');
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'content_admin';
    let isAssignedDoctor = false;
    if (userRole === 'doctor') {
      const doc = await pool.query(`SELECT id FROM doctors WHERE phone = $1`, [userPhone]);
      isAssignedDoctor = doc.rows.length > 0 && doc.rows[0].id === appt.rows[0].doctor_id;
    }
    if (!isAssignedDoctor && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    const result = await pool.query(
      `UPDATE appointments
       SET status = 'en_cours', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return res.json({ success: true, appointment: result.rows[0] });
  } catch (e) {
    console.error('[openConsultation]', e.message);
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 6. Symptômes pre-RDV (alias vers appointment_symptoms)
router.post('/:id/symptoms', authMiddleware, async (req, res) => {
  try {
    const appointmentId = parseInt(req.params.id);
    const { 
      motif, symptomes, duree_symptomes, 
      intensite, traitements_en_cours, remarques_patient 
    } = req.body;
    
    if (!motif) {
      return res.status(400).json({ success: false, message: 'Motif obligatoire' });
    }
    
    // Vérifie que le RDV existe
    const rdv = await pool.query(
      'SELECT id FROM appointments WHERE id = $1', [appointmentId]
    );
    if (!rdv.rows.length) {
      return res.status(404).json({ success: false, message: 'RDV introuvable' });
    }
    
    // Upsert dans appointment_symptoms
    await pool.query(
      `INSERT INTO appointment_symptoms 
        (appointment_id, motif, symptomes, duree_symptomes, intensite, traitements_en_cours, remarques_patient)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7)
       ON CONFLICT (appointment_id) DO UPDATE SET
        motif = EXCLUDED.motif,
        symptomes = EXCLUDED.symptomes,
        duree_symptomes = EXCLUDED.duree_symptomes,
        intensite = EXCLUDED.intensite,
        traitements_en_cours = EXCLUDED.traitements_en_cours,
        remarques_patient = EXCLUDED.remarques_patient`,
      [
        appointmentId,
        motif,
        JSON.stringify(symptomes || []),
        duree_symptomes || null,
        intensite ? String(intensite) : null,
        traitements_en_cours || null,
        remarques_patient || null
      ]
    );
    
    res.json({ success: true, message: 'Symptômes enregistrés' });
  } catch (err) {
    console.error('[SYMPTOMS]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Recherche RDV (accessible aux médecins)
router.get('/search', authMiddleware, doctorOnly, async (req, res) => {
  try {
    const { q } = req.query;
    const doctorPhone = req.user.phone;

    if (!q || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    // Récupérer d'abord l'ID du médecin
    const doctorResult = await pool.query(
      'SELECT id FROM doctors WHERE phone = $1',
      [doctorPhone]
    );

    if (!doctorResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Médecin introuvable' });
    }

    const doctorId = doctorResult.rows[0].id;
    const searchTerm = `%${q}%`;

    const result = await pool.query(
      `SELECT a.id, a.patient_phone, a.appointment_date, a.appointment_time, a.status, a.motif,
              u.full_name as patient_name, u.photo_url as patient_photo
       FROM appointments a
       LEFT JOIN users u ON u.phone = a.patient_phone
       WHERE a.doctor_id = $1
       AND (u.full_name ILIKE $2 OR a.patient_phone ILIKE $2 OR a.motif ILIKE $2)
       ORDER BY a.appointment_date DESC, a.appointment_time DESC
       LIMIT 20`,
      [doctorId, searchTerm]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[appointments-search]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;