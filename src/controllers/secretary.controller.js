// ============================================================
// BOLAMU — Controller Secrétariat (Sprint 8)
// ============================================================
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { normalizePhone } = require('../utils/phone');

// ─── GET AGENDA MÉDECIN ─────────────────────────────────────────────────────────────
async function getAgenda(req, res) {
    try {
        const { doctor_id } = req.params;
        const { date } = req.query;
        const clinicId = req.user.clinic_id;

        // Vérifier que le médecin appartient à la clinique du secrétaire
        const doctorCheck = await pool.query(
            `SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2`,
            [doctor_id, clinicId]
        );
        if (!doctorCheck.rows.length) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé à ce médecin' });
        }

        // Si date fournie, afficher RDV de cette date précise
        // Sinon, afficher RDV d'aujourd'hui et futurs
        let dateFilter;
        let queryParams;
        if (date) {
            dateFilter = 'a.appointment_date = $2';
            queryParams = [doctor_id, date];
        } else {
            dateFilter = 'a.appointment_date >= CURRENT_DATE';
            queryParams = [doctor_id];
        }

        // Récupérer les RDV du médecin avec symptômes
        const appointmentsResult = await pool.query(
            `SELECT a.id, a.patient_phone, a.appointment_time, a.status, a.reason,
                    s.motif as symptomes_motif,
                    s.symptomes as symptomes_liste
             FROM appointments a
             LEFT JOIN appointment_symptoms s ON s.appointment_id = a.id
             WHERE a.doctor_id = $1 AND ${dateFilter}
             ORDER BY a.appointment_time`,
            queryParams
        );

        // Récupérer les blocages agenda pour la date (si date fournie, sinon aujourd'hui)
        const blockDate = date || new Date().toISOString().split('T')[0];
        const blocksResult = await pool.query(
            `SELECT id, block_start, block_end, reason 
             FROM agenda_blocks 
             WHERE doctor_id = $1 AND block_date = $2
             ORDER BY block_start`,
            [doctor_id, blockDate]
        );

        return res.json({
            success: true,
            appointments: appointmentsResult.rows,
            blocks: blocksResult.rows
        });
    } catch (error) {
        console.error('[GET AGENDA]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// ─── POST CRÉER RDV PRÉSENTIEL ─────────────────────────────────────────────────────
async function createAppointment(req, res) {
    try {
        const { patient_phone, doctor_id, appointment_time, reason } = req.body;

        if (!patient_phone || !doctor_id || !appointment_time) {
            return res.status(400).json({ 
                success: false, 
                message: 'patient_phone, doctor_id et appointment_time sont requis' 
            });
        }

        const result = await pool.query(
            `INSERT INTO appointments (patient_phone, doctor_id, appointment_time, reason, status, created_at)
             VALUES ($1, $2, $3, $4, 'scheduled', NOW())
             RETURNING *`,
            [patient_phone, doctor_id, appointment_time, reason || '']
        );

        return res.status(201).json({
            success: true,
            message: 'RDV créé avec succès',
            appointment: result.rows[0]
        });
    } catch (error) {
        console.error('[CREATE APPOINTMENT]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// ─── GET FILE D'ATTENTE DU JOUR ─────────────────────────────────────────────────────
async function getQueue(req, res) {
    try {
        const { doctor_id } = req.params;
        const { date } = req.query;
        const queryDate = date || new Date().toISOString().split('T')[0];
        const clinicId = req.user.clinic_id;

        // Vérifier que le médecin appartient à la clinique du secrétaire
        const doctorCheck = await pool.query(
            `SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2`,
            [doctor_id, clinicId]
        );
        if (!doctorCheck.rows.length) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé à ce médecin' });
        }

        const result = await pool.query(
            `SELECT q.id, q.patient_phone, q.status, q.arrived_at, q.in_consultation_at, q.completed_at, q.notes,
                    u.full_name
             FROM queue_entries q
             LEFT JOIN users u ON u.phone = q.patient_phone
             WHERE q.doctor_id = $1 AND q.queue_date = $2
             ORDER BY q.arrived_at`,
            [doctor_id, queryDate]
        );

        return res.json({
            success: true,
            queue: result.rows
        });
    } catch (error) {
        console.error('[GET QUEUE]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// ─── POST AJOUTER PATIENT EN URGENCE ─────────────────────────────────────────────────────
async function addToQueue(req, res) {
    try {
        const { doctor_id, patient_phone, motif, is_urgent } = req.body;
        
        if (!doctor_id || !patient_phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'doctor_id et patient_phone requis' 
            });
        }
        
        const result = await pool.query(
            `INSERT INTO queue_entries 
                (doctor_id, patient_phone, motif, status, is_urgent, queue_date, arrived_at)
             VALUES ($1, $2, $3, 'waiting', $4, CURRENT_DATE, NOW())
             RETURNING *`,
            [doctor_id, patient_phone, motif || null, is_urgent || false]
        );
        
        return res.status(201).json({
            success: true,
            message: 'Patient ajouté à la file d\'attente',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[ADD TO QUEUE]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// ─── PATCH CHANGER STATUT FILE D'ATTENTE ─────────────────────────────────────────────
async function updateQueueStatus(req, res) {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = ['waiting', 'in_consultation', 'completed', 'absent'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Statut invalide' 
            });
        }

        const updateFields = { status };
        const updateValues = [status, id];
        let setClause = 'status = $1';

        // Mettre à jour les timestamps selon le statut
        if (status === 'in_consultation') {
            setClause += ', in_consultation_at = NOW()';
        } else if (status === 'completed') {
            setClause += ', completed_at = NOW()';
        }

        const result = await pool.query(
            `UPDATE queue_entries SET ${setClause} WHERE id = $2 RETURNING *`,
            updateValues
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Entrée file d\'attente introuvable' });
        }

        return res.json({
            success: true,
            message: 'Statut mis à jour',
            entry: result.rows[0]
        });
    } catch (error) {
        console.error('[UPDATE QUEUE STATUS]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// ─── POST BLOQUER CRÉNEAU MÉDECIN ─────────────────────────────────────────────────────
async function createAgendaBlock(req, res) {
    try {
        const { doctor_id, block_date, block_start, block_end, reason } = req.body;

        if (!doctor_id || !block_date || !block_start || !block_end) {
            return res.status(400).json({ 
                success: false, 
                message: 'doctor_id, block_date, block_start et block_end sont requis' 
            });
        }

        const result = await pool.query(
            `INSERT INTO agenda_blocks (doctor_id, block_date, block_start, block_end, reason, created_by, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())
             RETURNING *`,
            [doctor_id, block_date, block_start, block_end, reason || '', req.user.phone]
        );

        return res.status(201).json({
            success: true,
            message: 'Blocage créé avec succès',
            block: result.rows[0]
        });
    } catch (error) {
        console.error('[CREATE AGENDA BLOCK]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// ─── DELETE SUPPRIMER BLOCAGE ─────────────────────────────────────────────────────
async function deleteAgendaBlock(req, res) {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `DELETE FROM agenda_blocks WHERE id = $1 RETURNING *`,
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({ success: false, message: 'Blocage introuvable' });
        }

        return res.json({
            success: true,
            message: 'Blocage supprimé avec succès'
        });
    } catch (error) {
        console.error('[DELETE AGENDA BLOCK]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// ─── GET STATISTIQUES FLUX ─────────────────────────────────────────────────────────────
async function getStats(req, res) {
    try {
        const { doctor_id, date } = req.params;
        const queryDate = date || new Date().toISOString().split('T')[0];
        const clinicId = req.user.clinic_id;

        // Vérifier que le médecin appartient à la clinique du secrétaire
        const doctorCheck = await pool.query(
            `SELECT id FROM doctors WHERE id = $1 AND clinic_id = $2`,
            [doctor_id, clinicId]
        );
        if (!doctorCheck.rows.length) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé à ce médecin' });
        }

        // RDV du jour
        const appointmentsResult = await pool.query(
            `SELECT COUNT(*) as total, 
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
             FROM appointments 
             WHERE doctor_id = $1 AND appointment_date = $2`,
            [doctor_id, queryDate]
        );

        // File d'attente du jour
        const queueResult = await pool.query(
            `SELECT COUNT(*) as total,
                    AVG(EXTRACT(EPOCH FROM (completed_at - arrived_at))/60) as avg_wait_minutes
             FROM queue_entries 
             WHERE doctor_id = $1 AND queue_date = $2 AND completed_at IS NOT NULL`,
            [doctor_id, queryDate]
        );

        const stats = {
            date: queryDate,
            appointments: appointmentsResult.rows[0] || { total: 0, completed: 0, cancelled: 0 },
            queue: queueResult.rows[0] || { total: 0, avg_wait_minutes: 0 }
        };

        // Calculer taux de remplissage
        if (stats.appointments.total > 0) {
            stats.fill_rate = (stats.appointments.completed / stats.appointments.total) * 100;
        } else {
            stats.fill_rate = 0;
        }

        return res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[GET STATS]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// ─── GET LISTE SECRÉTAIRES (ADMIN) ─────────────────────────────────────────────────────
async function getAdminSecretaries(req, res) {
    try {
        const result = await pool.query(
            `SELECT phone, full_name, email, is_active, created_at 
             FROM users 
             WHERE role = 'secretaire'
             ORDER BY created_at DESC`
        );

        return res.json({
            success: true,
            secretaries: result.rows
        });
    } catch (error) {
        console.error('[GET ADMIN SECRETARIES]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// ─── POST CRÉER COMPTE SECRÉTAIRE (ADMIN) ─────────────────────────────────────────────
async function createSecretary(req, res) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { phone, full_name, email, password } = req.body;

        if (!phone || !full_name || !password) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                message: 'phone, full_name et password sont requis' 
            });
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await client.query(
            'SELECT phone FROM users WHERE phone = $1',
            [phone]
        );

        if (existingUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ 
                success: false, 
                message: 'Ce numéro de téléphone existe déjà' 
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Insérer dans users
        await client.query(
            `INSERT INTO users (phone, full_name, email, password, role, is_active, created_at)
             VALUES ($1, $2, $3, $4, 'secretaire', true, NOW())`,
            [phone, full_name, email || null, hashedPassword]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Compte secrétaire créé avec succès'
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[CREATE SECRETARY]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    } finally {
        client.release();
    }
}

// ─── POST ASSIGNER SECRÉTAIRE À PARTENAIRE (ADMIN) ─────────────────────────────────────
async function assignSecretary(req, res) {
    try {
        const phone = normalizePhone(req.params.phone || '');
        const { partner_type, partner_id, zone } = req.body;

        if (!partner_type) {
            return res.status(400).json({ 
                success: false, 
                message: 'partner_type est requis' 
            });
        }

        const validPartnerTypes = ['clinique', 'laboratoire', 'cms', 'agence_bolamu'];
        if (!validPartnerTypes.includes(partner_type)) {
            return res.status(400).json({ 
                success: false, 
                message: 'partner_type invalide' 
            });
        }

        const result = await pool.query(
            `INSERT INTO secretary_assignments (secretary_phone, partner_type, partner_id, zone, created_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING *`,
            [phone, partner_type, partner_id || null, zone || null]
        );

        return res.status(201).json({
            success: true,
            message: 'Secrétaire assigné avec succès',
            assignment: result.rows[0]
        });
    } catch (error) {
        console.error('[ASSIGN SECRETARY]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

module.exports = {
    getAgenda,
    createAppointment,
    getQueue,
    addToQueue,
    updateQueueStatus,
    createAgendaBlock,
    deleteAgendaBlock,
    getStats,
    getAdminSecretaries,
    createSecretary,
    assignSecretary
};
