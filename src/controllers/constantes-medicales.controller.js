const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');

// ─── RÉCUPÉRER LES CONSTANTES MÉDICALES D'UN PATIENT ─────────────────────────
async function getConstantes(req, res) {
    const phone = normalizePhone(req.params.phone || '');
    const userPhone = req.user?.phone;
    const userRole = req.user?.role;

    try {
        // Vérifier les droits : patient lui-même, médecin traitant, ou admin
        const isPatient = userPhone === phone;
        const isAdmin = userRole === 'admin' || userRole === 'content_admin';
        
        // Si c'est un médecin, vérifier qu'il a déjà eu des RDV avec ce patient
        let isTreatingDoctor = false;
        if (!isPatient && !isAdmin) {
            const doctorCheck = await pool.query(
                `SELECT COUNT(*) FROM appointments 
                 WHERE patient_phone = $1 AND doctor_id = (SELECT id FROM doctors WHERE phone = $2)`,
                [phone, userPhone]
            );
            isTreatingDoctor = parseInt(doctorCheck.rows[0].count) > 0;
        }

        if (!isPatient && !isAdmin && !isTreatingDoctor) {
            return res.status(403).json({ success: false, message: 'Accès refusé.' });
        }

        // Récupérer les constantes médicales
        const result = await pool.query(
            `SELECT 
                groupe_sanguin,
                allergies,
                maladies_chroniques,
                antecedents_medicaux,
                traitements_en_cours,
                poids,
                taille,
                contact_urgence_nom,
                contact_urgence_phone,
                contact_urgence_lien,
                constantes_remplies_par,
                constantes_updated_at
             FROM users
             WHERE phone = $1`,
            [phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient introuvable.' });
        }

        const constantes = result.rows[0];

        // Log l'accès au dossier si médecin ou admin
        if (!isPatient) {
            setImmediate(() => {
                logDossierAccess(phone, userPhone, userRole, 'constantes_medicales', req.ip);
            });
        }

        return res.json({ success: true, data: constantes });

    } catch (error) {
        console.error('[getConstantes] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── METTRE À JOUR LES CONSTANTES MÉDICALES (PATIENT) ─────────────────────────
async function updateConstantesPatient(req, res) {
    const userPhone = req.user?.phone;
    const userRole = req.user?.role;

    // Seul le patient peut modifier ses propres constantes
    if (userRole !== 'patient') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux patients.' });
    }

    const {
        groupe_sanguin,
        allergies,
        maladies_chroniques,
        antecedents_medicaux,
        traitements_en_cours,
        poids,
        taille,
        contact_urgence_nom,
        contact_urgence_phone,
        contact_urgence_lien
    } = req.body;

    try {
        // Construire la requête dynamique avec uniquement les champs fournis
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (groupe_sanguin !== undefined) {
            updates.push(`groupe_sanguin = $${paramIndex++}`);
            values.push(groupe_sanguin);
        }
        if (allergies !== undefined) {
            updates.push(`allergies = $${paramIndex++}`);
            values.push(allergies);
        }
        if (maladies_chroniques !== undefined) {
            updates.push(`maladies_chroniques = $${paramIndex++}`);
            values.push(maladies_chroniques);
        }
        if (antecedents_medicaux !== undefined) {
            updates.push(`antecedents_medicaux = $${paramIndex++}`);
            values.push(antecedents_medicaux);
        }
        if (traitements_en_cours !== undefined) {
            updates.push(`traitements_en_cours = $${paramIndex++}`);
            values.push(traitements_en_cours);
        }
        if (poids !== undefined) {
            updates.push(`poids = $${paramIndex++}`);
            values.push(poids);
        }
        if (taille !== undefined) {
            updates.push(`taille = $${paramIndex++}`);
            values.push(taille);
        }
        if (contact_urgence_nom !== undefined) {
            updates.push(`contact_urgence_nom = $${paramIndex++}`);
            values.push(contact_urgence_nom);
        }
        if (contact_urgence_phone !== undefined) {
            updates.push(`contact_urgence_phone = $${paramIndex++}`);
            values.push(contact_urgence_phone);
        }
        if (contact_urgence_lien !== undefined) {
            updates.push(`contact_urgence_lien = $${paramIndex++}`);
            values.push(contact_urgence_lien);
        }

        // Toujours mettre à jour ces champs
        updates.push(`constantes_remplies_par = $${paramIndex++}`);
        values.push('patient');
        updates.push(`constantes_updated_at = $${paramIndex++}`);
        values.push(new Date());

        // Ajouter le phone du patient pour le WHERE
        values.push(userPhone);

        if (updates.length === 2) { // Seulement les champs constants_remplies_par et constantes_updated_at
            return res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour.' });
        }

        const query = `
            UPDATE users
            SET ${updates.join(', ')}
            WHERE phone = $${paramIndex}
            RETURNING 
                groupe_sanguin,
                allergies,
                maladies_chroniques,
                antecedents_medicaux,
                traitements_en_cours,
                poids,
                taille,
                contact_urgence_nom,
                contact_urgence_phone,
                contact_urgence_lien,
                constantes_remplies_par,
                constantes_updated_at
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient introuvable.' });
        }

        // Insert dans audit_log
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ($1, $2, 'constantes_medicales', NULL, $3::jsonb)`,
            [
                'CONSTANTES_UPDATED_PATIENT',
                userPhone,
                JSON.stringify({ actor_role: 'patient', new_values: result.rows[0], ip_address: req.ip || null })
            ]
        );

        return res.json({
            success: true,
            message: 'Constantes médicales mises à jour avec succès.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[updateConstantesPatient] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── METTRE À JOUR LES CONSTANTES MÉDICALES (MÉDECIN) ─────────────────────────
async function updateConstantesMedecin(req, res) {
    const userPhone = req.user?.phone;
    const userRole = req.user?.role;

    // Seul un médecin peut modifier les constantes
    if (userRole !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Accès réservé aux médecins.' });
    }

    const { patient_phone } = req.body;

    if (!patient_phone) {
        return res.status(400).json({ success: false, message: 'patient_phone est requis.' });
    }

    const {
        groupe_sanguin,
        allergies,
        maladies_chroniques,
        antecedents_medicaux,
        traitements_en_cours,
        poids,
        taille,
        contact_urgence_nom,
        contact_urgence_phone,
        contact_urgence_lien
    } = req.body;

    try {
        // Vérifier que le médecin a eu un RDV avec ce patient
        const rdvCheck = await pool.query(
            `SELECT COUNT(*) FROM appointments 
             WHERE patient_phone = $1 AND doctor_id = (SELECT id FROM doctors WHERE phone = $2)`,
            [patient_phone, userPhone]
        );

        if (parseInt(rdvCheck.rows[0].count) === 0) {
            return res.status(403).json({ 
                success: false, 
                message: 'Vous n\'avez pas encore eu de consultation avec ce patient.' 
            });
        }

        // Construire la requête dynamique avec uniquement les champs fournis
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (groupe_sanguin !== undefined) {
            updates.push(`groupe_sanguin = $${paramIndex++}`);
            values.push(groupe_sanguin);
        }
        if (allergies !== undefined) {
            updates.push(`allergies = $${paramIndex++}`);
            values.push(allergies);
        }
        if (maladies_chroniques !== undefined) {
            updates.push(`maladies_chroniques = $${paramIndex++}`);
            values.push(maladies_chroniques);
        }
        if (antecedents_medicaux !== undefined) {
            updates.push(`antecedents_medicaux = $${paramIndex++}`);
            values.push(antecedents_medicaux);
        }
        if (traitements_en_cours !== undefined) {
            updates.push(`traitements_en_cours = $${paramIndex++}`);
            values.push(traitements_en_cours);
        }
        if (poids !== undefined) {
            updates.push(`poids = $${paramIndex++}`);
            values.push(poids);
        }
        if (taille !== undefined) {
            updates.push(`taille = $${paramIndex++}`);
            values.push(taille);
        }
        if (contact_urgence_nom !== undefined) {
            updates.push(`contact_urgence_nom = $${paramIndex++}`);
            values.push(contact_urgence_nom);
        }
        if (contact_urgence_phone !== undefined) {
            updates.push(`contact_urgence_phone = $${paramIndex++}`);
            values.push(contact_urgence_phone);
        }
        if (contact_urgence_lien !== undefined) {
            updates.push(`contact_urgence_lien = $${paramIndex++}`);
            values.push(contact_urgence_lien);
        }

        // Toujours mettre à jour ces champs
        updates.push(`constantes_remplies_par = $${paramIndex++}`);
        values.push('medecin');
        updates.push(`constantes_updated_at = $${paramIndex++}`);
        values.push(new Date());

        // Ajouter le phone du patient pour le WHERE
        values.push(patient_phone);

        if (updates.length === 2) { // Seulement les champs constants_remplies_par et constantes_updated_at
            return res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour.' });
        }

        const query = `
            UPDATE users
            SET ${updates.join(', ')}
            WHERE phone = $${paramIndex}
            RETURNING 
                groupe_sanguin,
                allergies,
                maladies_chroniques,
                antecedents_medicaux,
                traitements_en_cours,
                poids,
                taille,
                contact_urgence_nom,
                contact_urgence_phone,
                contact_urgence_lien,
                constantes_remplies_par,
                constantes_updated_at
        `;

        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient introuvable.' });
        }

        // Insert dans audit_log
        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ($1, $2, 'constantes_medicales', NULL, $3::jsonb)`,
            [
                'CONSTANTES_UPDATED_MEDECIN',
                userPhone,
                JSON.stringify({ actor_role: 'doctor', patient_phone, new_values: result.rows[0], ip_address: req.ip || null })
            ]
        );

        // Insert dans dossier_access_log
        await pool.query(
            `INSERT INTO dossier_access_log (patient_phone, accessed_by_phone, accessed_by_role, access_type, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [patient_phone, userPhone, 'doctor', 'constantes_medicales_update', req.ip || null]
        );

        return res.json({
            success: true,
            message: 'Constantes médicales mises à jour avec succès.',
            data: result.rows[0]
        });

    } catch (error) {
        console.error('[updateConstantesMedecin] Erreur :', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── LOG D'ACCÈS AU DOSSIER (fonction utilitaire interne) ─────────────────────
async function logDossierAccess(patientPhone, accessorPhone, accessorRole, accessType, ip) {
    try {
        await pool.query(
            `INSERT INTO dossier_access_log (patient_phone, accessed_by_phone, accessed_by_role, access_type, ip_address)
             VALUES ($1, $2, $3, $4, $5)`,
            [patientPhone, accessorPhone, accessorRole, accessType, ip || null]
        );
    } catch (error) {
        console.error('[logDossierAccess] Erreur (non bloquante) :', error.message);
    }
}

module.exports = {
    getConstantes,
    updateConstantesPatient,
    updateConstantesMedecin
};
