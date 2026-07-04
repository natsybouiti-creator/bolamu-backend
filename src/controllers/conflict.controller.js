// ============================================================
// BOLAMU — Contrôleur Conflits (Sprint 3)
// ============================================================
const pool = require('../config/db');
const logger = require('../config/logger');
const {
    createConflict,
    transitionStatut,
    addMessage,
    assignAgent,
    suspendrePartenaire
} = require('../services/conflict.service');

// ─── CRÉER UN CONFLIT (patient uniquement) ─────────────────────────────────────
async function createConflictController(req, res) {
    const { partner_phone, partner_type, subject, description, priorite } = req.body;
    const patient_phone = req.user.phone; // Utiliser le phone du user authentifié

    if (!patient_phone || !partner_phone || !partner_type || !subject || !description) {
        return res.status(400).json({ success: false, message: 'Champs obligatoires : partner_phone, partner_type, subject, description' });
    }

    try {
        const result = await createConflict({ patient_phone, partner_phone, partner_type, sujet: subject, description, priorite });
        return res.status(201).json(result);
    } catch (error) {
        console.error('[createConflictController]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉCUPÉRER UN CONFLIT (patient voit le sien, admin voit tous) ───────────────
async function getConflict(req, res) {
    const { id } = req.params;
    const requestPhone = req.user.phone;
    const requestRole = req.user.role;

    try {
        const conflictResult = await pool.query(
            `SELECT c.*, 
                    u_patient.full_name as patient_name,
                    u_partner.full_name as partner_name,
                    u_agent.full_name as agent_name
             FROM conflicts c
             LEFT JOIN users u_patient ON u_patient.phone = c.patient_phone
             LEFT JOIN users u_partner ON u_partner.phone = c.partner_phone
             LEFT JOIN users u_agent ON u_agent.phone = c.agent_phone
             WHERE c.id = $1`,
            [id]
        );

        if (!conflictResult.rows.length) {
            return res.status(404).json({ success: false, message: 'Conflit introuvable.' });
        }

        const conflict = conflictResult.rows[0];

        // Vérifier les droits d'accès
        if (requestRole !== 'admin') {
            if (requestRole === 'patient' && conflict.patient_phone !== requestPhone) {
                return res.status(403).json({ success: false, message: 'Accès refusé.' });
            }
            if (requestRole === 'doctor' && conflict.partner_phone !== requestPhone) {
                return res.status(403).json({ success: false, message: 'Accès refusé.' });
            }
            if (requestRole === 'pharmacie' && conflict.partner_phone !== requestPhone) {
                return res.status(403).json({ success: false, message: 'Accès refusé.' });
            }
            if (requestRole === 'laboratoire' && conflict.partner_phone !== requestPhone) {
                return res.status(403).json({ success: false, message: 'Accès refusé.' });
            }
        }

        // Récupérer les messages
        const messagesResult = await pool.query(
            `SELECT cm.*, u.full_name as sender_name
             FROM conflict_messages cm
             LEFT JOIN users u ON u.phone = cm.sender_phone
             WHERE cm.conflict_id = $1
             ORDER BY cm.created_at ASC`,
            [id]
        );

        // Récupérer les actions
        const actionsResult = await pool.query(
            `SELECT ca.*, u.full_name as acteur_name
             FROM conflict_actions ca
             LEFT JOIN users u ON u.phone = ca.acteur_phone
             WHERE ca.conflict_id = $1
             ORDER BY ca.created_at DESC`,
            [id]
        );

        return res.json({
            success: true,
            data: {
                conflict: conflict,
                messages: messagesResult.rows,
                actions: actionsResult.rows
            }
        });

    } catch (error) {
        console.error('[getConflict]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── LISTER LES CONFLITS (admin : tous + filtres) ───────────────────────────────
async function listConflicts(req, res) {
    const { statut, priorite, page = 1, per_page = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(per_page);

    try {
        const conditions = ['1=1'];
        const params = [];

        if (statut) {
            params.push(statut);
            conditions.push(`c.statut = $${params.length}`);
        }
        if (priorite) {
            params.push(priorite);
            conditions.push(`c.priorite = $${params.length}`);
        }

        params.push(parseInt(per_page));
        params.push(offset);

        const result = await pool.query(
            `SELECT c.*, 
                    u_patient.full_name as patient_name,
                    u_partner.full_name as partner_name,
                    u_agent.full_name as agent_name
             FROM conflicts c
             LEFT JOIN users u_patient ON u_patient.phone = c.patient_phone
             LEFT JOIN users u_partner ON u_partner.phone = c.partner_phone
             LEFT JOIN users u_agent ON u_agent.phone = c.agent_phone
             WHERE ${conditions.join(' AND ')}
             ORDER BY c.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const countResult = await pool.query(
            `SELECT COUNT(*) FROM conflicts c WHERE ${conditions.join(' AND ')}`,
            params.slice(0, -2)
        );
        const total = parseInt(countResult.rows[0].count);

        return res.json({
            success: true,
            data: {
                conflicts: result.rows,
                pagination: {
                    total: total,
                    page: parseInt(page),
                    per_page: parseInt(per_page),
                    pages: Math.ceil(total / parseInt(per_page))
                }
            }
        });

    } catch (error) {
        console.error('[listConflicts]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── METTRE À JOUR LE STATUT (agent/admin selon rôle) ─────────────────────────
async function updateStatut(req, res) {
    const { id } = req.params;
    const { statut, commentaire } = req.body;
    const requestPhone = req.user.phone;
    const requestRole = req.user.role;
    const isSuperAdmin = requestRole === 'admin';

    if (!statut) {
        return res.status(400).json({ success: false, message: 'Statut requis.' });
    }

    if (statut === 'rejected' && !commentaire) {
        return res.status(400).json({ success: false, message: 'Commentaire obligatoire pour le rejet.' });
    }

    try {
        await transitionStatut(id, statut, requestPhone, requestRole, commentaire, isSuperAdmin);
        return res.json({ success: true, message: 'Statut mis à jour avec succès.' });
    } catch (error) {
        console.error('[updateStatut]', error.message);
        return res.status(400).json({ success: false, message: error.message });
    }
}

// ─── AJOUTER UN MESSAGE (patient, partenaire, agent, admin) ────────────────────
async function addMessageController(req, res) {
    const { id } = req.params;
    const { message, pieces_jointes } = req.body;
    const requestPhone = req.user.phone;
    const requestRole = req.user.role;

    if (!message) {
        return res.status(400).json({ success: false, message: 'Message requis.' });
    }

    try {
        await addMessage(id, requestPhone, requestRole, message, pieces_jointes);
        return res.json({ success: true, message: 'Message ajouté avec succès.' });
    } catch (error) {
        console.error('[addMessageController]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── ASSIGNER UN AGENT (admin uniquement) ─────────────────────────────────────
async function assignAgentController(req, res) {
    const { id } = req.params;
    const { agent_phone } = req.body;
    const requestPhone = req.user.phone;

    if (!agent_phone) {
        return res.status(400).json({ success: false, message: 'Agent phone requis.' });
    }

    try {
        await assignAgent(id, agent_phone, requestPhone);
        return res.json({ success: true, message: 'Agent assigné avec succès.' });
    } catch (error) {
        console.error('[assignAgentController]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── ESCALADER (marqueur de priorité — super_admin fusionné dans admin, cf. migration_057) ──
async function escaladeSupAdmin(req, res) {
    const { id } = req.params;
    const requestPhone = req.user.phone;

    try {
        await pool.query(
            `UPDATE conflicts SET escalade_sup_admin = TRUE, updated_at = NOW() WHERE id = $1`,
            [id]
        );

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
             VALUES ('conflict.escalated', $1, 'conflicts', $2, $3::jsonb)`,
            [requestPhone, id, JSON.stringify({ escalade_sup_admin: true })]
        ).catch((err) => logger.error('[escaladeSupAdmin] Audit log error:', err.message));

        return res.json({ success: true, message: 'Conflit escaladé au super admin.' });
    } catch (error) {
        console.error('[escaladeSupAdmin]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── RÉSOUDRE UN CONFLIT (agent/admin) ────────────────────────────────────────
async function resolveConflict(req, res) {
    const { id } = req.params;
    const { resolution } = req.body;
    const requestPhone = req.user.phone;
    const requestRole = req.user.role;

    if (!resolution) {
        return res.status(400).json({ success: false, message: 'Résolution requise.' });
    }

    try {
        await pool.query(
            `UPDATE conflicts SET resolution = $1, updated_at = NOW() WHERE id = $2`,
            [resolution, id]
        );

        await transitionStatut(id, 'resolved', requestPhone, requestRole, 'Conflit résolu', requestRole === 'admin');

        return res.json({ success: true, message: 'Conflit résolu avec succès.' });
    } catch (error) {
        console.error('[resolveConflict]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── FERMER UN CONFLIT (admin) ─────────────────────────────────────────────────
async function closeConflict(req, res) {
    const { id } = req.params;
    const requestPhone = req.user.phone;
    const requestRole = req.user.role;

    try {
        await transitionStatut(id, 'closed', requestPhone, requestRole, 'Conflit fermé', requestRole === 'admin');
        return res.json({ success: true, message: 'Conflit fermé avec succès.' });
    } catch (error) {
        console.error('[closeConflict]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ─── SUSPENDRE PARTENAIRE (admin uniquement) ───────────────────────────────────
async function suspendrePartenaireController(req, res) {
    const { id } = req.params;
    const requestPhone = req.user.phone;

    try {
        const conflictResult = await pool.query(
            `SELECT partner_phone FROM conflicts WHERE id = $1`,
            [id]
        );

        if (!conflictResult.rows.length) {
            return res.status(404).json({ success: false, message: 'Conflit introuvable.' });
        }

        const partner_phone = conflictResult.rows[0].partner_phone;

        await suspendrePartenaire(partner_phone, requestPhone, id);

        return res.json({ success: true, message: 'Partenaire suspendu avec succès.' });
    } catch (error) {
        console.error('[suspendrePartenaireController]', error.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = {
    createConflictController,
    getConflict,
    listConflicts,
    updateStatut,
    addMessageController,
    assignAgentController,
    escaladeSupAdmin,
    resolveConflict,
    closeConflict,
    suspendrePartenaireController
};
