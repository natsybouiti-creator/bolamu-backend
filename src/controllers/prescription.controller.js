const pool = require('../config/db');
const logger = require('../config/logger');
const { normalizePhone } = require('../utils/phone');
const { buildWameLink } = require('../services/wame.service');
const { isSSPFreeText } = require('../services/smartflow.service');
const { sendAutoMessage } = require('../services/whatsapp.service');

// ─── CRÉER UNE ORDONNANCE (médecin après validation consultation) ─────────────
async function createPrescription(req, res) {
    const { appointment_id, patient_phone, doctor_phone, medications, instructions } = req.body;

    if (!patient_phone || !doctor_phone || !medications) {
        return res.status(400).json({
            success: false,
            message: 'Champs obligatoires manquants : patient_phone, doctor_phone, medications'
        });
    }

    try {
        // Récupérer le session_code depuis l'appointment
        let session_code = null;
        if (appointment_id) {
            const appt = await pool.query(
                'SELECT session_code FROM appointments WHERE id = $1',
                [appointment_id]
            );
            if (appt.rows.length > 0) {
                session_code = appt.rows[0].session_code;
            }
        }

        // Vérifier qu'il n'existe pas déjà une ordonnance active pour ce RDV
        if (appointment_id) {
            const existing = await pool.query(
                `SELECT id FROM prescriptions WHERE appointment_id = $1 AND status = 'active'`,
                [appointment_id]
            );
            if (existing.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: 'Une ordonnance active existe déjà pour ce rendez-vous.'
                });
            }
        }

        // is_ssp calculé une seule fois à la création (lookup ssp_catalog),
        // jamais recalculé après (migration_059). Le champ medications est un
        // texte libre (pas de lignes structurées comme ordonnance_items) :
        // isSSPFreeText() cherche si un nom du catalogue apparaît DANS ce texte
        // (posologie/fréquence incluses), contrairement à isSSP() qui exige une
        // correspondance courte et exacte.
        const sspCheck = await isSSPFreeText(medications, 'medicament');

        const result = await pool.query(
            `INSERT INTO prescriptions
                (appointment_id, patient_phone, doctor_phone, medications, instructions, status, session_code, is_ssp)
             VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
             RETURNING *`,
            [appointment_id || null, patient_phone, doctor_phone, medications, instructions || null, session_code, sspCheck.is_ssp]
        );

        const prescriptionId = result.rows[0].id;

        // Notification asynchrone au patient (ne bloque pas la réponse)
        setImmediate(async () => {
            try {
                const { notify } = require('../services/notification.service');
                await notify(patient_phone, 'message_recu', {
                    message: `Votre ordonnance Bolamu est disponible. Présentez-la dans une pharmacie partenaire.`
                });

                const patientRowPres = await pool.query(
                    `SELECT first_name FROM users WHERE phone = $1`,
                    [patient_phone]
                );
                const patientFirstNamePres = patientRowPres.rows[0]?.first_name || patient_phone;

                buildWameLink(patient_phone, 'ordonnance_creee', {
                    prenom: patientFirstNamePres,
                    ref_ordonnance: prescriptionId
                });
            } catch (e) { console.error('[NOTIFY PRESCRIPTION]', e.message); }
        });

        return res.status(201).json({
            success: true,
            message: 'Ordonnance créée avec succès.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[createPrescription] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉCUPÉRER ORDONNANCE PAR CODE SESSION (pharmacie scanner) ───────────────
async function getPrescriptionBySession(req, res) {
    const { code } = req.params;

    if (!code) {
        return res.status(400).json({ success: false, message: 'Code session requis.' });
    }

    try {
        const result = await pool.query(
            `SELECT p.*, a.session_code as appt_session_code, a.appointment_date, a.appointment_time,
                    d.full_name as doctor_name, d.specialty as doctor_specialty
             FROM prescriptions p
             LEFT JOIN appointments a ON p.appointment_id = a.id
             LEFT JOIN doctors d ON p.doctor_phone = d.phone
             WHERE (a.session_code = $1 OR p.session_code = $1)
               AND p.status = 'active'
             ORDER BY p.created_at DESC
             LIMIT 1`,
            [code.toUpperCase()]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Aucune ordonnance active trouvée pour ce code.'
            });
        }

        return res.json({ success: true, data: result.rows[0] });

    } catch (error) {
        console.error('[getPrescriptionBySession] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── CONFIRMER DÉLIVRANCE (pharmacie) ────────────────────────────────────────
// Génère un clearing_transactions à la dispensation (avant : aucun clearing
// généré par ce circuit, contrairement à pharmacie.service.js::dispenserOrdonnance()
// — voir ARCHITECTURE_SOINS_BOLAMU.md §3). Tarif lu depuis platform_config
// (migration_060) : la référence dispenserOrdonnance() lisait
// partner_zones.tarif_fcfa, colonne inexistante sur la table réelle — jamais
// fonctionnelle, non reproduite ici.
async function deliverPrescription(req, res) {
    const { prescription_id, pharmacie_phone, session_code } = req.body;

    if (!prescription_id || !pharmacie_phone) {
        return res.status(400).json({
            success: false,
            message: 'prescription_id et pharmacie_phone requis.'
        });
    }

    const client = await pool.connect();
    try {
        const check = await client.query(
            `SELECT * FROM prescriptions WHERE id = $1`,
            [prescription_id]
        );

        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Ordonnance introuvable.' });
        }

        if (check.rows[0].status === 'delivered') {
            return res.status(409).json({
                success: false,
                message: 'Cette ordonnance a déjà été délivrée — réutilisation impossible.'
            });
        }

        const patient_phone_delivered = check.rows[0].patient_phone;
        const doctor_phone_delivered = check.rows[0].doctor_phone;

        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE prescriptions
             SET status = 'delivered',
                 pharmacie_phone = $1,
                 delivered_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [pharmacie_phone, prescription_id]
        );

        // Tarif clearing CDR (platform_config, jamais hardcodé)
        const tarifRes = await client.query(
            `SELECT config_value FROM platform_config WHERE config_key = 'tarif_clearing_pharmacie'`
        );
        const tarif = parseInt(tarifRes.rows[0]?.config_value, 10) || 2500;

        await client.query(
            `INSERT INTO clearing_transactions (partner_phone, partner_type, reference_id, reference_type, amount_fcfa, status)
             VALUES ($1, 'pharmacie', $2, 'prescription', $3, 'pending')`,
            [normalizePhone(pharmacie_phone), prescription_id, tarif]
        );

        // Log audit
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('prescription_delivered', $1, 'prescriptions', $2, $3::jsonb)`,
            [pharmacie_phone, prescription_id, JSON.stringify({ session_code, patient_phone: patient_phone_delivered, tarif_fcfa: tarif })]
        );

        await client.query('COMMIT');

        logger.info('[PRESCRIPTION] Ordonnance délivrée', { prescription_id, tarif });

        // Notifications asynchrones patient + médecin (non bloquant)
        setImmediate(async () => {
            try {
                const [patientRow, pharmacieRow] = await Promise.all([
                    pool.query(`SELECT first_name FROM users WHERE phone = $1`, [patient_phone_delivered]),
                    pool.query(`SELECT name FROM pharmacies WHERE phone = $1`, [normalizePhone(pharmacie_phone)])
                ]);
                const patientName = patientRow.rows[0]?.first_name || 'Patient';
                const pharmacieName = pharmacieRow.rows[0]?.name || 'la pharmacie';
                const dateRecuperation = new Date().toLocaleDateString('fr-FR');

                await sendAutoMessage(patient_phone_delivered, 'bolamu_ordonnance_dispensee', [patientName, pharmacieName, dateRecuperation]);
                if (doctor_phone_delivered) {
                    await sendAutoMessage(doctor_phone_delivered, 'bolamu_ordonnance_dispensee_medecin', [patientName, pharmacieName]);
                }
            } catch (e) { console.error('[NOTIFY DELIVER]', e.message); }
        });

        return res.json({
            success: true,
            message: 'Délivrance confirmée.',
            data: result.rows[0]
        });

    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('[deliverPrescription] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    } finally {
        client.release();
    }
}

// ─── HISTORIQUE DÉLIVRANCES PAR PHARMACIE ────────────────────────────────────
async function getPrescriptionsByPharmacie(req, res) {
    const phone = normalizePhone(req.params.phone || '');
    const userPhone = normalizePhone(req.user?.phone || '');
    const userRole = req.user?.role;

    const isOwnPharmacie = userRole === 'pharmacie' && userPhone === phone;
    const isAdmin = userRole === 'admin' || userRole === 'content_admin';
    if (!isOwnPharmacie && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    try {
        const result = await pool.query(
            `SELECT p.*, a.session_code as appt_session_code, d.full_name as doctor_name
             FROM prescriptions p
             LEFT JOIN appointments a ON p.appointment_id = a.id
             LEFT JOIN doctors d ON p.doctor_phone = d.phone
             WHERE p.pharmacie_phone = $1
             ORDER BY p.delivered_at DESC
             LIMIT 50`,
            [phone]
        );

        return res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('[getPrescriptionsByPharmacie] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── ORDONNANCES D'UN PATIENT ─────────────────────────────────────────────────
async function getPrescriptionsByPatient(req, res) {
    const phone = normalizePhone(req.params.phone || '');
    const userPhone = normalizePhone(req.user?.phone || '');
    const userRole = req.user?.role;

    const isPatient = userPhone === phone;
    const isAdmin = userRole === 'admin' || userRole === 'content_admin';

    let isTreatingDoctor = false;
    if (!isPatient && !isAdmin && userRole === 'doctor') {
        const check = await pool.query(
            `SELECT COUNT(*) FROM appointments a
             JOIN doctors d ON d.id = a.doctor_id
             WHERE a.patient_phone = $1 AND d.phone = $2`,
            [phone, userPhone]
        );
        isTreatingDoctor = parseInt(check.rows[0].count) > 0;
    }

    if (!isPatient && !isAdmin && !isTreatingDoctor) {
        return res.status(403).json({ success: false, message: 'Accès refusé.' });
    }

    try {
        const result = await pool.query(
            `SELECT p.*, a.session_code as appt_session_code, a.appointment_date,
                    d.full_name as doctor_name, d.specialty
             FROM prescriptions p
             LEFT JOIN appointments a ON p.appointment_id = a.id
             LEFT JOIN doctors d ON p.doctor_phone = d.phone
             WHERE p.patient_phone = $1
             ORDER BY p.created_at DESC`,
            [phone]
        );

        return res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error('[getPrescriptionsByPatient] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = {
    createPrescription,
    getPrescriptionBySession,
    deliverPrescription,
    getPrescriptionsByPharmacie,
    getPrescriptionsByPatient
};