// ============================================================
// BOLAMU — Service Conflits (Sprint 3)
// ============================================================
const pool = require('../config/db');

// ─── GÉNÉRER RÉFÉRENCE CONFLIT ─────────────────────────────────────────────
function generateReference() {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const random = Math.floor(1000 + Math.random() * 9000); // XXXX (4 chiffres)
    return `CONF-${dateStr}-${random}`;
}

// ─── CRÉER UN CONFLIT ───────────────────────────────────────────────────────
async function createConflict({ patient_phone, partner_phone, partner_type, sujet, description, priorite }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const reference = generateReference();
        const statut = 'created';

        // Insérer le conflit
        const conflictResult = await client.query(
            `INSERT INTO conflicts 
                (reference, patient_phone, partner_phone, partner_type, sujet, description, statut, priorite)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, reference, statut, created_at`,
            [reference, patient_phone, partner_phone, partner_type, sujet, description, statut, priorite || 'normale']
        );

        const conflictId = conflictResult.rows[0].id;

        // Insérer l'action de création
        await client.query(
            `INSERT INTO conflict_actions 
                (conflict_id, action, ancien_statut, nouveau_statut, acteur_phone, acteur_role, commentaire)
             VALUES ($1, 'created', NULL, $2, $3, 'patient', 'Création du conflit')`,
            [conflictId, statut, patient_phone]
        );

        // Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('conflict.created', $1, 'conflicts', $2, $3)`,
            [patient_phone, conflictId, JSON.stringify({ reference, partner_phone, partner_type, sujet })]
        ).catch(() => {});

        await client.query('COMMIT');

        return {
            success: true,
            data: {
                conflict_id: conflictId,
                reference: reference,
                statut: statut,
                created_at: conflictResult.rows[0].created_at
            }
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[createConflict]', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// ─── MATRICE DE TRANSITIONS VALIDES ───────────────────────────────────────────
const VALID_TRANSITIONS = {
    created: ['assigned', 'pending_review', 'rejected'],
    pending_review: ['assigned', 'rejected'],
    assigned: ['investigating'],
    investigating: ['waiting_response', 'resolved'],
    waiting_response: ['investigating', 'resolved'],
    resolved: ['closed'],
    closed: ['archived'],
    rejected: ['archived'],
    archived: [] // terminal
};

// ─── TRANSITION DE STATUT ─────────────────────────────────────────────────────
async function transitionStatut(conflict_id, nouveau_statut, acteur_phone, acteur_role, commentaire, isSuperAdmin = false) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Récupérer le conflit actuel
        const conflictResult = await client.query(
            `SELECT statut FROM conflicts WHERE id = $1`,
            [conflict_id]
        );

        if (!conflictResult.rows.length) {
            await client.query('ROLLBACK');
            throw new Error('Conflit introuvable');
        }

        const ancien_statut = conflictResult.rows[0].statut;

        // Vérifier que la transition est valide (sauf pour super_admin)
        if (!isSuperAdmin) {
            const validTransitions = VALID_TRANSITIONS[ancien_statut] || [];
            if (!validTransitions.includes(nouveau_statut)) {
                await client.query('ROLLBACK');
                throw new Error(`Transition invalide : ${ancien_statut} → ${nouveau_statut}. Transitions valides : ${validTransitions.join(', ')}`);
            }
        }

        // Mettre à jour le conflit
        const updates = ['statut = $1', 'updated_at = NOW()'];
        const values = [nouveau_statut];
        let paramCount = 2;

        if (nouveau_statut === 'resolved') {
            updates.push(`resolved_at = NOW()`);
        }
        if (nouveau_statut === 'closed') {
            updates.push(`closed_at = NOW()`);
        }

        values.push(conflict_id);

        await client.query(
            `UPDATE conflicts SET ${updates.join(', ')} WHERE id = $${paramCount + 1}`,
            values
        );

        // Insérer l'action de transition
        await client.query(
            `INSERT INTO conflict_actions 
                (conflict_id, action, ancien_statut, nouveau_statut, acteur_phone, acteur_role, commentaire)
             VALUES ($1, 'transition', $2, $3, $4, $5, $6)`,
            [conflict_id, ancien_statut, nouveau_statut, acteur_phone, acteur_role, commentaire || null]
        );

        // Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('conflict.transition', $1, 'conflicts', $2, $3)`,
            [acteur_phone, conflict_id, JSON.stringify({ ancien_statut, nouveau_statut, commentaire })]
        ).catch(() => {});

        await client.query('COMMIT');

        return { success: true, message: `Statut mis à jour : ${ancien_statut} → ${nouveau_statut}` };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[transitionStatut]', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// ─── AJOUTER UN MESSAGE ───────────────────────────────────────────────────────
async function addMessage(conflict_id, sender_phone, sender_role, message, pieces_jointes = []) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Insérer le message
        await client.query(
            `INSERT INTO conflict_messages 
                (conflict_id, sender_phone, sender_role, message, pieces_jointes)
             VALUES ($1, $2, $3, $4, $5)`,
            [conflict_id, sender_phone, sender_role, message, JSON.stringify(pieces_jointes)]
        );

        // Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('conflict.message', $1, 'conflict_messages', $2, $3)`,
            [sender_phone, conflict_id, JSON.stringify({ sender_role, message_length: message.length })]
        ).catch(() => {});

        await client.query('COMMIT');

        return { success: true, message: 'Message ajouté avec succès' };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[addMessage]', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// ─── ASSIGNER UN AGENT ───────────────────────────────────────────────────────
async function assignAgent(conflict_id, agent_phone, admin_phone) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Mettre à jour l'agent
        await client.query(
            `UPDATE conflicts SET agent_phone = $1, updated_at = NOW() WHERE id = $2`,
            [agent_phone, conflict_id]
        );

        // Transition vers 'assigned'
        await transitionStatut(conflict_id, 'assigned', admin_phone, 'admin', 'Assignation de l\'agent', false);

        await client.query('COMMIT');

        return { success: true, message: 'Agent assigné avec succès' };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[assignAgent]', error.message);
        throw error;
    } finally {
        client.release();
    }
}

// ─── SUSPENDRE PARTENAIRE ─────────────────────────────────────────────────────
async function suspendrePartenaire(partner_phone, admin_phone, conflict_id) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Soft delete : is_active = false
        await client.query(
            `UPDATE users SET is_active = FALSE WHERE phone = $1`,
            [partner_phone]
        );

        // Mettre à jour aussi la table spécifique selon le rôle
        const userResult = await client.query(`SELECT role FROM users WHERE phone = $1`, [partner_phone]);
        if (userResult.rows.length > 0) {
            const role = userResult.rows[0].role;
            if (role === 'doctor') {
                await client.query(`UPDATE doctors SET is_active = FALSE, status = 'suspended' WHERE phone = $1`, [partner_phone]);
            } else if (role === 'pharmacie') {
                await client.query(`UPDATE pharmacies SET is_active = FALSE, status = 'suspended' WHERE phone = $1`, [partner_phone]);
            } else if (role === 'laboratoire') {
                await client.query(`UPDATE laboratories SET is_active = FALSE, status = 'suspended' WHERE phone = $1`, [partner_phone]);
            }
        }

        // Audit log
        await client.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('partner.suspended', $1, 'users', NULL, $2)`,
            [admin_phone, JSON.stringify({ partner_phone, conflict_id })]
        ).catch(() => {});

        await client.query('COMMIT');

        return { success: true, message: 'Partenaire suspendu avec succès' };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[suspendrePartenaire]', error.message);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    generateReference,
    createConflict,
    transitionStatut,
    addMessage,
    assignAgent,
    suspendrePartenaire,
    VALID_TRANSITIONS
};
