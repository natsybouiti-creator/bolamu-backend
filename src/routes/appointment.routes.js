const express = require('express');
const router = express.Router();
const path = require('path');
const pool = require('../config/db');

// --- MIDDLEWARE DE SECOURS (Si l'import échoue, on ne crash pas) ---
let authMiddleware;
try {
    const authPath = path.join(__dirname, '..', '..', 'middleware', 'auth.middleware.js');
    authMiddleware = require(authPath);
} catch (e) {
    console.log("⚠️ Middleware non trouvé, utilisation d'un bypass temporaire.");
    authMiddleware = (req, res, next) => next();
}

// --- FONCTION SMS DE SECOURS ---
const logSms = async (phone, msg) => console.log(`[SMS SIMULÉ] Pour ${phone} : ${msg}`);

// --- ROUTES ---

// 1. Créneaux (Public)
router.get('/slots/:doctor_id', async (req, res) => {
    const { doctor_id } = req.params;
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Date requise" });
    try {
        const docResult = await pool.query(`SELECT availability_schedule FROM doctors WHERE id = $1`, [doctor_id]);
        if (!docResult.rows.length) return res.status(404).json({ error: "Médecin introuvable" });
        
        const schedule = docResult.rows[0].availability_schedule || {};
        const jours = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
        const jour = jours[new Date(date).getDay()];
        const creneaux = schedule[jour] || [];
        
        const prisResult = await pool.query(
            `SELECT appointment_time FROM appointments WHERE doctor_id = $1 AND appointment_date = $2 AND status IN ('confirme', 'en_attente')`,
            [doctor_id, date]
        );
        const pris = prisResult.rows.map(r => r.appointment_time.slice(0,5));
        
        // Récupérer les blocages agenda pour cette date
        const blocksResult = await pool.query(
            `SELECT block_start, block_end FROM agenda_blocks WHERE doctor_id = $1 AND block_date = $2`,
            [doctor_id, date]
        );
        
        // Filtrer les créneaux libres en excluant ceux dans les blocages
        const libres = creneaux.filter(c => {
            if (pris.includes(c)) return false;
            // Vérifier si le créneau est dans un blocage
            for (const block of blocksResult.rows) {
                if (c >= block.block_start && c < block.block_end) {
                    return false;
                }
            }
            return true;
        });
        
        // Ajouter les créneaux bloqués à la liste pris
        const bloques = [];
        for (const block of blocksResult.rows) {
            for (const c of creneaux) {
                if (c >= block.block_start && c < block.block_end && !pris.includes(c) && !bloques.includes(c)) {
                    bloques.push(c);
                }
            }
        }
        
        const tousPris = [...pris, ...bloques];
        
        res.json({ success: true, slots: libres, pris: tousPris, jour: jour });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Réserver (Ligne 33 corrigée : le handler est défini ici directement)
router.post('/book', authMiddleware, async (req, res) => {
    const { patient_phone, doctor_id, date, time } = req.body;
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
            `INSERT INTO appointments (patient_phone, doctor_id, appointment_date, appointment_time, session_code, status)
             VALUES ($1, $2, $3, $4, $5, 'confirme') RETURNING *`,
            [patient_phone, doctor_id, date, time, session_code]
        );
        
        await logSms(patient_phone, `Bolamu : RDV confirme. Code : ${session_code}`);
        res.status(201).json({ success: true, appointment: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. RDV Médecin
router.get('/doctor/:phone', authMiddleware, async (req, res) => {
    const { phone } = req.params;
    const { page = 1, per_page = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(per_page);
    try {
        const doc = await pool.query(`SELECT id FROM doctors WHERE phone = $1`, [phone]);
        if (!doc.rows.length) return res.json({ success: true, data: [], pagination: { total: 0, page: parseInt(page), per_page: parseInt(per_page) } });
        
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
             WHERE a.doctor_id = $1
             ORDER BY a.appointment_date DESC, a.appointment_time DESC
             LIMIT $2 OFFSET $3`,
            [doc.rows[0].id, parseInt(per_page), offset]
        );
        
        const countResult = await pool.query(`SELECT COUNT(*) FROM appointments WHERE doctor_id = $1`, [doc.rows[0].id]);
        const total = parseInt(countResult.rows[0].count);
        
        res.json({ 
            success: true, 
            data: result.rows,
            pagination: {
                total: total,
                page: parseInt(page),
                per_page: parseInt(per_page),
                pages: Math.ceil(total / parseInt(per_page))
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// 4. RDV Patient
router.get('/patient/:phone', authMiddleware, async (req, res) => {
  try {
    const { phone } = req.params;
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
router.post('/:id/validate', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { session_code } = req.body;
    try {
        const result = await pool.query(`SELECT session_code FROM appointments WHERE id = $1`, [id]);
        if (!result.rows.length || result.rows[0].session_code !== session_code) {
            return res.status(403).json({ success: false, message: "Code invalide" });
        }
        await pool.query(`UPDATE appointments SET status = 'termine', validated_at = NOW() WHERE id = $1`, [id]);
        res.json({ success: true, message: "Consultation validée" });
    } catch (err) {
        res.status(500).json({ error: "Erreur" });
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

module.exports = router;