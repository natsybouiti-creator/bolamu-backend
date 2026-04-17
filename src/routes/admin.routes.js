// ============================================================
// BOLAMU — Routes Admin v2 — Cockpit complet
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../../middleware/auth.middleware');
const { sendBolamuSms } = require('../services/sms.service');

function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux administrateurs.' });
    }
    next();
}

// ─── STATS GLOBALES ───────────────────────────────────────────────────────────
router.get('/stats', authMiddleware, adminOnly, async (req, res) => {
    try {
        const [
            patients, doctors, pharmacies, laboratories,
            appointments, prescriptions,
            pendingDoctors, pendingPharmacies, pendingLabs,
            fraudHigh, fraudTotal,
            revenueToday, revenueMonth, revenueTotal,
            rdvToday, rdvMonth, rdvDone,
            bannedUsers, activeSubscriptions
        ] = await Promise.all([
            pool.query(`SELECT COUNT(*) FROM users WHERE role = 'patient'`),
            pool.query(`SELECT COUNT(*) FROM doctors WHERE is_active = TRUE AND status = 'verified'`),
            pool.query(`SELECT COUNT(*) FROM pharmacies WHERE is_active = TRUE AND status = 'verified'`),
            pool.query(`SELECT COUNT(*) FROM laboratories WHERE is_active = TRUE AND status = 'verified'`),
            pool.query(`SELECT COUNT(*) FROM appointments`),
            pool.query(`SELECT COUNT(*) FROM prescriptions`),
            pool.query(`SELECT COUNT(*) FROM doctors WHERE status = 'pending'`),
            pool.query(`SELECT COUNT(*) FROM pharmacies WHERE status = 'pending'`),
            pool.query(`SELECT COUNT(*) FROM laboratories WHERE status = 'pending'`),
            pool.query(`SELECT COUNT(*) FROM fraud_signals WHERE severity = 'high'`),
            pool.query(`SELECT COUNT(*) FROM fraud_signals`),
            pool.query(`SELECT COALESCE(SUM(amount_fcfa),0) as total FROM payments WHERE status='success' AND created_at >= CURRENT_DATE`),
            pool.query(`SELECT COALESCE(SUM(amount_fcfa),0) as total FROM payments WHERE status='success' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`),
            pool.query(`SELECT COALESCE(SUM(amount_fcfa),0) as total FROM payments WHERE status='success'`),
            pool.query(`SELECT COUNT(*) FROM appointments WHERE appointment_date = CURRENT_DATE`),
            pool.query(`SELECT COUNT(*) FROM appointments WHERE appointment_date >= DATE_TRUNC('month', CURRENT_DATE)`),
            pool.query(`SELECT COUNT(*) FROM appointments WHERE status = 'termine'`),
            pool.query(`SELECT COUNT(*) FROM users WHERE banned = TRUE`),
            pool.query(`SELECT COUNT(*) FROM users WHERE role='patient' AND statut_abonnement = 'actif'`)
        ]);

        res.json({
            success: true,
            data: {
                users: {
                    patients: parseInt(patients.rows[0].count),
                    doctors: parseInt(doctors.rows[0].count),
                    pharmacies: parseInt(pharmacies.rows[0].count),
                    laboratories: parseInt(laboratories.rows[0].count),
                    active_subscriptions: parseInt(activeSubscriptions.rows[0].count),
                    banned: parseInt(bannedUsers.rows[0].count)
                },
                activity: {
                    appointments_total: parseInt(appointments.rows[0].count),
                    appointments_today: parseInt(rdvToday.rows[0].count),
                    appointments_month: parseInt(rdvMonth.rows[0].count),
                    appointments_done: parseInt(rdvDone.rows[0].count),
                    prescriptions: parseInt(prescriptions.rows[0].count)
                },
                pending: {
                    doctors: parseInt(pendingDoctors.rows[0].count),
                    pharmacies: parseInt(pendingPharmacies.rows[0].count),
                    laboratories: parseInt(pendingLabs.rows[0].count),
                    total: parseInt(pendingDoctors.rows[0].count) + parseInt(pendingPharmacies.rows[0].count) + parseInt(pendingLabs.rows[0].count)
                },
                fraud: {
                    high_severity: parseInt(fraudHigh.rows[0].count),
                    total: parseInt(fraudTotal.rows[0].count)
                },
                revenue: {
                    today: parseFloat(revenueToday.rows[0].total),
                    month: parseFloat(revenueMonth.rows[0].total),
                    total: parseFloat(revenueTotal.rows[0].total)
                }
            }
        });
    } catch (err) {
        console.error('[admin/stats]', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── STATS PATIENTS ───────────────────────────────────────────────────────────
router.get('/stats/patients', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'patient'`);
        res.json({ success: true, count: parseInt(result.rows[0].count) });
    } catch (e) { res.status(500).json({ success: false, count: 0 }); }
});

// ─── STATS APPOINTMENTS ───────────────────────────────────────────────────────
router.get('/stats/appointments', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM appointments ORDER BY created_at DESC LIMIT 500`);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, data: [] }); }
});

// ─── COMPTES EN ATTENTE ───────────────────────────────────────────────────────
router.get('/pending', authMiddleware, adminOnly, async (req, res) => {
    try {
        const doctors = await pool.query(
            `SELECT id, 'doctor' as type, full_name as name, phone, specialty as detail,
                    city, trust_score, document_url, status, created_at
             FROM doctors WHERE status = 'pending' ORDER BY created_at DESC`
        );
        const pharmacies = await pool.query(
            `SELECT id, 'pharmacie' as type, name, phone, rccm_number as detail,
                    city, trust_score, document_url, status, created_at
             FROM pharmacies WHERE status = 'pending' ORDER BY created_at DESC`
        );
        const labs = await pool.query(
            `SELECT id, 'laboratoire' as type, name as business_name, phone, rccm_number as detail,
                    city, trust_score, document_url, status, created_at
             FROM laboratories WHERE status = 'pending' ORDER BY created_at DESC`
        );
        const all = [...doctors.rows, ...pharmacies.rows, ...labs.rows]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ success: true, data: all });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── VALIDER / REJETER ────────────────────────────────────────────────────────
router.patch('/validate', authMiddleware, adminOnly, async (req, res) => {
    const { id, type, action, reason } = req.body;
    if (!id || !type || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Paramètres invalides.' });
    }
    const newStatus = action === 'approve' ? 'verified' : 'rejected';
    const table = type === 'doctor' ? 'doctors' : type === 'pharmacie' ? 'pharmacies' : 'laboratories';
    try {
        const result = await pool.query(
            `UPDATE ${table} SET status = $1, is_active = $2 WHERE id = $3 RETURNING *`,
            [newStatus, action === 'approve', id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Compte introuvable.' });
        const row = result.rows[0];
        const phone = row.phone;
        const name = row.full_name || row.name;
        try {
            const msg = action === 'approve'
                ? `Bolamu : Félicitations ${name} ! Votre dossier a été validé. Connectez-vous sur bolamu-backend.onrender.com`
                : `Bolamu : Votre dossier n'a pas été validé. Motif : ${reason || 'Dossier incomplet'}. Contactez le support.`;
            await sendBolamuSms(phone, msg);
        } catch(e) {}
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ($1, 'admin', $2, $3, $4)`,
            [`${type}.${newStatus}`, table, parseInt(id), JSON.stringify({ reason: reason || null })]
        ).catch(() => {});
        res.json({ success: true, message: `Compte ${newStatus === 'verified' ? 'validé ✅' : 'rejeté ❌'}.`, status: newStatus });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── CHANGER STATUT MÉDECIN/PHARMACIE/LABO ────────────────────────────────────
router.patch('/doctors/:id/status', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { status, reason } = req.body;
    if (!['verified','rejected','suspended','pending'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Statut invalide.' });
    }
    try {
        const result = await pool.query(`UPDATE doctors SET status=$1, is_active=$2 WHERE id=$3 RETURNING *`, [status, status==='verified', id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Introuvable.' });
        await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ($1,'admin','doctors',$2,$3)`,
            [`doctor.${status}`, parseInt(id), JSON.stringify({ reason })]).catch(() => {});
        res.json({ success: true, data: result.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

router.patch('/pharmacies/:id/status', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { status, reason } = req.body;
    try {
        const result = await pool.query(`UPDATE pharmacies SET status=$1, is_active=$2 WHERE id=$3 RETURNING *`, [status, status==='verified', id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Introuvable.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

router.patch('/laboratories/:id/status', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    const { status, reason } = req.body;
    try {
        const result = await pool.query(`UPDATE laboratories SET status=$1, is_active=$2 WHERE id=$3 RETURNING *`, [status, status==='verified', id]);
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Introuvable.' });
        res.json({ success: true, data: result.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── SIGNAUX FRAUDE ───────────────────────────────────────────────────────────
router.get('/fraud', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT fs.*, u.full_name as actor_name, u.role as actor_role
             FROM fraud_signals fs
             LEFT JOIN users u ON u.phone = fs.actor_phone
             ORDER BY fs.created_at DESC LIMIT 200`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── SUSPENDRE POUR FRAUDE ────────────────────────────────────────────────────
router.patch('/fraud/:id/suspend', authMiddleware, adminOnly, async (req, res) => {
    const { id } = req.params;
    try {
        const signal = await pool.query(`SELECT * FROM fraud_signals WHERE id = $1`, [id]);
        if (!signal.rows.length) return res.status(404).json({ success: false, message: 'Signal introuvable.' });
        const phone = signal.rows[0].actor_phone;
        await pool.query(`UPDATE users SET is_active = FALSE, banned = TRUE, ban_reason = 'Fraude détectée', banned_at = NOW() WHERE phone = $1`, [phone]);
        await pool.query(`UPDATE doctors SET is_active = FALSE, status = 'suspended' WHERE phone = $1`, [phone]).catch(() => {});
        await pool.query(`UPDATE pharmacies SET is_active = FALSE, status = 'suspended' WHERE phone = $1`, [phone]).catch(() => {});
        await pool.query(`UPDATE laboratories SET is_active = FALSE, status = 'suspended' WHERE phone = $1`, [phone]).catch(() => {});
        try { await sendBolamuSms(phone, `Bolamu : Votre compte a été suspendu suite à une activité suspecte détectée. Contactez le support.`); } catch(e) {}
        await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('account.banned.fraud','admin','fraud_signals',$1,$2)`,
            [parseInt(id), JSON.stringify({ phone })]).catch(() => {});
        res.json({ success: true, message: `Compte ${phone} suspendu pour fraude 🔒` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── TOUS LES UTILISATEURS ────────────────────────────────────────────────────
router.get('/users', authMiddleware, adminOnly, async (req, res) => {
    const { role, search, page = 1 } = req.query;
    const limit = 50;
    const offset = (parseInt(page) - 1) * limit;
    try {
        const conditions = ['1=1'];
        const params = [];
        if (role && role !== 'all') { params.push(role); conditions.push(`u.role = $${params.length}`); }
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(u.phone ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`);
        }
        params.push(limit, offset);
        const result = await pool.query(
            `SELECT u.id, u.phone, u.full_name, u.role, u.is_active, u.banned, u.ban_reason,
                    u.statut_abonnement, u.date_fin_abonnement, u.created_at, u.bolamu_id, u.credits_balance,
                    COALESCE(d.full_name, ph.name, l.name) as pro_name,
                    COALESCE(d.status, ph.status, l.status) as pro_status,
                    COALESCE(d.member_code, ph.member_code, l.member_code) as member_code
             FROM users u
             LEFT JOIN doctors d ON d.phone = u.phone AND u.role = 'doctor'
             LEFT JOIN pharmacies ph ON ph.phone = u.phone AND u.role = 'pharmacie'
             LEFT JOIN laboratories l ON l.phone = u.phone AND u.role = 'laboratoire'
             WHERE ${conditions.join(' AND ')}
             ORDER BY u.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        const countResult = await pool.query(
            `SELECT COUNT(*) FROM users u WHERE ${conditions.join(' AND ')}`,
            params.slice(0, -2)
        );
        res.json({ success: true, data: result.rows, total: parseInt(countResult.rows[0].count) });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── FICHE COMPLÈTE D'UN UTILISATEUR ─────────────────────────────────────────
router.get('/users/:phone/profile', authMiddleware, adminOnly, async (req, res) => {
    const { phone } = req.params;
    try {
        const user = await pool.query(`SELECT * FROM users WHERE phone = $1`, [phone]);
        if (!user.rows.length) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        const u = user.rows[0];
        let proProfile = null;
        if (u.role === 'doctor') { const r = await pool.query(`SELECT * FROM doctors WHERE phone=$1`, [phone]); proProfile = r.rows[0]||null; }
        else if (u.role === 'pharmacie') { const r = await pool.query(`SELECT * FROM pharmacies WHERE phone=$1`, [phone]); proProfile = r.rows[0]||null; }
        else if (u.role === 'laboratoire') { const r = await pool.query(`SELECT * FROM laboratories WHERE phone=$1`, [phone]); proProfile = r.rows[0]||null; }

        const [appointments, prescriptions, payments, fraudSignals, creditHistory] = await Promise.all([
            pool.query(`SELECT a.*, d.full_name as doctor_name FROM appointments a LEFT JOIN doctors d ON d.id = a.doctor_id WHERE a.patient_phone=$1 OR d.phone=$1 ORDER BY a.created_at DESC LIMIT 30`, [phone]),
            pool.query(`SELECT * FROM prescriptions WHERE patient_phone=$1 OR doctor_phone=$1 ORDER BY created_at DESC LIMIT 30`, [phone]),
            pool.query(`SELECT * FROM payments WHERE patient_phone=$1 ORDER BY created_at DESC LIMIT 30`, [phone]),
            pool.query(`SELECT * FROM fraud_signals WHERE actor_phone=$1 ORDER BY created_at DESC`, [phone]),
            pool.query(`SELECT * FROM credit_transactions WHERE phone=$1 ORDER BY created_at DESC LIMIT 20`, [phone]).catch(() => ({ rows: [] }))
        ]);

        res.json({
            success: true,
            data: {
                user: u,
                pro_profile: proProfile,
                appointments: appointments.rows,
                prescriptions: prescriptions.rows,
                payments: payments.rows,
                fraud_signals: fraudSignals.rows,
                credit_history: creditHistory.rows
            }
        });
    } catch (err) {
        console.error('[admin/profile]', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── BANNIR UN COMPTE ─────────────────────────────────────────────────────────
router.patch('/users/:phone/ban', authMiddleware, adminOnly, async (req, res) => {
    const { phone } = req.params;
    const { reason } = req.body;
    try {
        const result = await pool.query(
            `UPDATE users SET is_active=FALSE, banned=TRUE, ban_reason=$1, banned_at=NOW() WHERE phone=$2 RETURNING id,phone,full_name,role`,
            [reason || 'Décision administrative', phone]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        const u = result.rows[0];
        await pool.query(`UPDATE doctors SET is_active=FALSE, status='suspended' WHERE phone=$1`, [phone]).catch(() => {});
        await pool.query(`UPDATE pharmacies SET is_active=FALSE, status='suspended' WHERE phone=$1`, [phone]).catch(() => {});
        await pool.query(`UPDATE laboratories SET is_active=FALSE, status='suspended' WHERE phone=$1`, [phone]).catch(() => {});
        try { await sendBolamuSms(phone, `Bolamu : Votre compte a été suspendu. Motif : ${reason || 'Décision administrative'}. Pour contester, contactez le support.`); } catch(e) {}
        await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('account.banned','admin','users',$1,$2)`,
            [u.id, JSON.stringify({ reason, role: u.role })]).catch(() => {});
        res.json({ success: true, message: `Compte ${phone} banni 🔒`, data: u });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── RÉANIMER UN COMPTE ───────────────────────────────────────────────────────
router.patch('/users/:phone/unban', authMiddleware, adminOnly, async (req, res) => {
    const { phone } = req.params;
    try {
        const result = await pool.query(
            `UPDATE users SET is_active=TRUE, banned=FALSE, ban_reason=NULL, banned_at=NULL WHERE phone=$1 RETURNING id,phone,full_name,role`,
            [phone]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        const u = result.rows[0];
        await pool.query(`UPDATE doctors SET is_active=TRUE, status='verified' WHERE phone=$1 AND status='suspended'`, [phone]).catch(() => {});
        await pool.query(`UPDATE pharmacies SET is_active=TRUE, status='verified' WHERE phone=$1 AND status='suspended'`, [phone]).catch(() => {});
        await pool.query(`UPDATE laboratories SET is_active=TRUE, status='verified' WHERE phone=$1 AND status='suspended'`, [phone]).catch(() => {});
        try { await sendBolamuSms(phone, `Bolamu : Votre compte a été réactivé. Vous pouvez vous reconnecter sur bolamu-backend.onrender.com`); } catch(e) {}
        await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('account.unbanned','admin','users',$1,$2)`,
            [u.id, JSON.stringify({ role: u.role })]).catch(() => {});
        res.json({ success: true, message: `Compte ${phone} réactivé ✅`, data: u });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── OUVRIR / FERMER UN COMPTE (toggle) ──────────────────────────────────────
router.patch('/users/:phone/toggle', authMiddleware, adminOnly, async (req, res) => {
    const { phone } = req.params;
    try {
        const result = await pool.query(
            `UPDATE users SET is_active = NOT is_active WHERE phone=$1 RETURNING id,phone,full_name,role,is_active`,
            [phone]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        const u = result.rows[0];
        if (u.role === 'doctor') await pool.query(`UPDATE doctors SET is_active=$1 WHERE phone=$2`, [u.is_active, phone]).catch(() => {});
        if (u.role === 'pharmacie') await pool.query(`UPDATE pharmacies SET is_active=$1 WHERE phone=$2`, [u.is_active, phone]).catch(() => {});
        if (u.role === 'laboratoire') await pool.query(`UPDATE laboratories SET is_active=$1 WHERE phone=$2`, [u.is_active, phone]).catch(() => {});
        await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ($1,'admin','users',$2,$3)`,
            [u.is_active ? 'account.opened' : 'account.suspended', u.id, JSON.stringify({ phone, role: u.role })]).catch(() => {});
        res.json({ success: true, data: u, message: u.is_active ? 'Compte réactivé ✅' : 'Compte suspendu 🔒' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ─── PLATFORM CONFIG ──────────────────────────────────────────────────────────
router.get('/config', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM platform_config ORDER BY id`);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

router.patch('/config/:key', authMiddleware, adminOnly, async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    if (!value) return res.status(400).json({ success: false, message: 'value requis.' });
    try {
        const result = await pool.query(
            `UPDATE platform_config SET value=$1, updated_at=NOW() WHERE key=$2 RETURNING *`,
            [value, key]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Clé introuvable.' });
        await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('config.updated','admin','platform_config',NULL,$1)`,
            [JSON.stringify({ key, value })]).catch(() => {});
        res.json({ success: true, data: result.rows[0], message: `${key} mis à jour → ${value}` });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── ABONNEMENTS PROS (pharmacies/labos mise en avant) ───────────────────────
router.patch('/pros/:type/:id/abonnement', authMiddleware, adminOnly, async (req, res) => {
    const { type, id } = req.params;
    const { active } = req.body;
    const table = type === 'pharmacie' ? 'pharmacies' : 'laboratories';
    try {
        const debut = active ? new Date() : null;
        const fin = active ? new Date(Date.now() + 30*24*60*60*1000) : null;
        const result = await pool.query(
            `UPDATE ${table} SET abonnement_actif=$1, abonnement_debut=$2, abonnement_fin=$3 WHERE id=$4 RETURNING *`,
            [active, debut, fin, id]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Introuvable.' });
        res.json({ success: true, data: result.rows[0], message: active ? 'Abonnement pro activé ✅' : 'Abonnement pro désactivé' });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── TOUS LES MÉDECINS ────────────────────────────────────────────────────────
router.get('/doctors', authMiddleware, adminOnly, async (req, res) => {
    const { status } = req.query;
    try {
        const where = status ? `WHERE status = '${status}'` : '';
        const result = await pool.query(
            `SELECT id, full_name, phone, specialty, city, neighborhood, status, trust_score,
                    member_code, document_url, total_consultations, is_active, momo_number,
                    registration_number, created_at
             FROM doctors ${where} ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── TOUTES LES PHARMACIES ────────────────────────────────────────────────────
router.get('/pharmacies', authMiddleware, adminOnly, async (req, res) => {
    const { status } = req.query;
    try {
        const where = status ? `WHERE status = '${status}'` : '';
        const result = await pool.query(
            `SELECT id, name, phone, city, rccm_number, responsible_name, status, trust_score,
                    member_code, document_url, is_active, momo_number, abonnement_actif,
                    abonnement_fin, created_at
             FROM pharmacies ${where} ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── TOUS LES LABORATOIRES ────────────────────────────────────────────────────
router.get('/laboratories', authMiddleware, adminOnly, async (req, res) => {
    const { status } = req.query;
    try {
        const where = status ? `WHERE status = '${status}'` : '';
        const result = await pool.query(
            `SELECT id, name as business_name, phone, city, rccm_number, director_name, status, trust_score,
                    member_code, document_url, is_active, momo_number, abonnement_actif,
                    abonnement_fin, created_at
             FROM laboratories ${where} ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── TOUS LES RDV ─────────────────────────────────────────────────────────────
router.get('/appointments', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.*, d.full_name as doctor_name, d.specialty
             FROM appointments a
             LEFT JOIN doctors d ON d.id = a.doctor_id
             ORDER BY a.created_at DESC LIMIT 500`
        );
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── TOUTES LES PRESCRIPTIONS ─────────────────────────────────────────────────
router.get('/prescriptions', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.*, d.full_name as doctor_name
             FROM prescriptions p
             LEFT JOIN doctors d ON d.phone = p.doctor_phone
             ORDER BY p.created_at DESC LIMIT 500`
        );
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── PAIEMENTS ────────────────────────────────────────────────────────────────
router.get('/payments', authMiddleware, adminOnly, async (req, res) => {
    const { page = 1 } = req.query;
    const limit = 100;
    const offset = (parseInt(page) - 1) * limit;
    try {
        const result = await pool.query(
            `SELECT p.*, u.full_name as patient_name
             FROM payments p LEFT JOIN users u ON u.phone = p.patient_phone
             ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        const total = await pool.query(`SELECT COUNT(*), COALESCE(SUM(amount_fcfa),0) as sum FROM payments WHERE status='success'`);
        res.json({ success: true, data: result.rows, total_count: parseInt(total.rows[0].count), total_revenue: parseFloat(total.rows[0].sum) });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── JOURNAL AUDIT ────────────────────────────────────────────────────────────
router.get('/audit', authMiddleware, adminOnly, async (req, res) => {
    const { event_type, limit = 300 } = req.query;
    try {
        let query = `SELECT * FROM audit_log`;
        const params = [];
        if (event_type) { query += ` WHERE event_type = $1`; params.push(event_type); }
        query += ` ORDER BY created_at DESC LIMIT ${parseInt(limit)}`;
        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});

// ─── CRÉDITS : ATTRIBUTION MANUELLE ──────────────────────────────────────────
router.post('/credits/grant', authMiddleware, adminOnly, async (req, res) => {
    const { phone, amount, reason } = req.body;
    if (!phone || !amount || !reason) return res.status(400).json({ success: false, message: 'phone, amount, reason requis.' });
    try {
        await pool.query(
            `INSERT INTO credits (phone, role, balance, total_earned, total_spent, consecutive_months)
             SELECT phone, role, 0, 0, 0, 0 FROM users WHERE phone=$1
             ON CONFLICT (phone) DO NOTHING`, [phone]
        );
        await pool.query(`UPDATE credits SET balance=balance+$1, total_earned=total_earned+$1, updated_at=NOW() WHERE phone=$2`, [parseInt(amount), phone]);
        await pool.query(`UPDATE users SET credits_balance=credits_balance+$1 WHERE phone=$2`, [parseInt(amount), phone]);
        await pool.query(`INSERT INTO credit_transactions (phone, type, amount, reason, balance_after) SELECT $1,'earn',$2,$3,(SELECT balance FROM credits WHERE phone=$1)`, [phone, parseInt(amount), reason]);
        try { await sendBolamuSms(phone, `Bolamu Credits : +${amount} crédits ajoutés ! Motif : ${reason}. Consultez votre dashboard.`); } catch(e) {}
        await pool.query(`INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('credits.granted','admin','credits',NULL,$1)`,
            [JSON.stringify({ phone, amount, reason })]).catch(() => {});
        res.json({ success: true, message: `${amount} crédits ajoutés à ${phone}` });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur : ' + e.message }); }
});

// ─── CRÉDITS : LISTE TOUS LES COMPTES ────────────────────────────────────────
router.get('/credits', authMiddleware, adminOnly, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT c.*, COALESCE(u.full_name, d.full_name, ph.name, l.name) as display_name
             FROM credits c
             LEFT JOIN users u ON u.phone = c.phone AND u.role = 'patient'
             LEFT JOIN doctors d ON d.phone = c.phone
             LEFT JOIN pharmacies ph ON ph.phone = c.phone
             LEFT JOIN laboratories l ON l.phone = c.phone
             ORDER BY c.balance DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: 'Erreur serveur.' }); }
});
// POST /admin/subscriptions/activate
router.post('/subscriptions/activate', authMiddleware, adminOnly, async (req, res) => {
  try {
    const adminCheck = await pool.query(`SELECT * FROM users WHERE phone = $1 AND role = 'admin'`, [req.user.phone]);
    if (!adminCheck.rows.length) return res.status(403).json({ success: false, message: 'Accès refusé' });
    const { phone, plan, billing = 'monthly', notes } = req.body;
    const PLANS = { essentiel:{monthly:1000,annual:12000}, standard:{monthly:2500,annual:30000}, premium:{monthly:5000,annual:60000} };
    if (!phone || !PLANS[plan]) return res.status(400).json({ success: false, message: 'phone et plan valide requis' });
    const amount = billing === 'annual' ? PLANS[plan].annual : PLANS[plan].monthly;
    const startDate = new Date();
    const endDate = new Date();
    billing === 'annual' ? endDate.setFullYear(endDate.getFullYear()+1) : endDate.setMonth(endDate.getMonth()+1);
    await db.query(
      `INSERT INTO subscriptions (phone, plan, status, amount_fcfa, started_at, expires_at, activated_by, notes)
       VALUES ($1,$2,'active',$3,$4,$5,'admin',$6)
       ON CONFLICT (phone) DO UPDATE SET plan=EXCLUDED.plan, status='active', amount_fcfa=EXCLUDED.amount_fcfa,
       started_at=EXCLUDED.started_at, expires_at=EXCLUDED.expires_at, activated_by='admin', notes=EXCLUDED.notes, updated_at=NOW()`,
      [phone, plan, amount, startDate, endDate, notes||null]
    );
    await db.query(`UPDATE users SET is_active=TRUE, updated_at=NOW() WHERE phone=$1`, [phone]);
    await db.query(`INSERT INTO audit_log (event_type, actor_phone, target_table) VALUES ('subscription_manual_activation',$1,'subscriptions')`, [req.user.phone]);
    res.json({ success:true, message:`Abonnement ${plan} activé pour ${phone}`, expires_at:endDate });
  } catch(e) { res.status(500).json({ success:false, message:e.message }); }
});
module.exports = router;
