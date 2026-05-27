// ============================================================
// BOLAMU — Controller Secrétariat (Sprint 8)
// ============================================================
const pool = require('../config/db');
const {
    ajouterFileAttente,
    appellerPatient,
    terminerConsultation,
    getFileAttente,
    bloquerAgenda,
    getAgendaJour,
    annulerRDV,
    getDashboardStats
} = require('../services/secretariat.service');

// Ajouter patient en file d'attente
async function ajouterFileAttenteController(req, res) {
    try {
        const { patient_phone, doctor_phone, motif, priorite } = req.body;
        const secretaire_phone = req.user.phone;

        // Récupérer partenaire_phone du secrétaire
        const secretaireResult = await pool.query(`
            SELECT partenaire_phone FROM secretaires WHERE phone = $1 AND is_active = TRUE
        `, [secretaire_phone]);

        if (secretaireResult.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Secrétaire non trouvé' });
        }

        const partenaire_phone = secretaireResult.rows[0].partenaire_phone;

        const result = await ajouterFileAttente(partenaire_phone, patient_phone, doctor_phone, motif, priorite, secretaire_phone);
        res.json(result);
    } catch (error) {
        console.error('[Secretariat] Erreur ajouterFileAttente:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// Appeler patient suivant
async function appellerPatientController(req, res) {
    try {
        const { id } = req.params;
        const secretaire_phone = req.user.phone;

        const result = await appellerPatient(id, secretaire_phone);
        res.json(result);
    } catch (error) {
        console.error('[Secretariat] Erreur appellerPatient:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Terminer consultation
async function terminerConsultationController(req, res) {
    try {
        const { id } = req.params;
        const secretaire_phone = req.user.phone;

        const result = await terminerConsultation(id, secretaire_phone);
        res.json(result);
    } catch (error) {
        console.error('[Secretariat] Erreur terminerConsultation:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Obtenir file d'attente du jour
async function getFileAttenteController(req, res) {
    try {
        const secretaire_phone = req.user.phone;

        // Récupérer partenaire_phone du secrétaire
        const secretaireResult = await pool.query(`
            SELECT partenaire_phone FROM secretaires WHERE phone = $1 AND is_active = TRUE
        `, [secretaire_phone]);

        if (secretaireResult.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Secrétaire non trouvé' });
        }

        const partenaire_phone = secretaireResult.rows[0].partenaire_phone;

        const result = await getFileAttente(partenaire_phone);
        res.json(result);
    } catch (error) {
        console.error('[Secretariat] Erreur getFileAttente:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// Bloquer créneau agenda
async function bloquerAgendaController(req, res) {
    try {
        const { doctor_phone, date, heure_debut, heure_fin, type, motif } = req.body;
        const secretaire_phone = req.user.phone;

        const result = await bloquerAgenda(doctor_phone, date, heure_debut, heure_fin, type, motif, secretaire_phone);
        res.json(result);
    } catch (error) {
        console.error('[Secretariat] Erreur bloquerAgenda:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Obtenir agenda du jour
async function getAgendaJourController(req, res) {
    try {
        const { doctor_phone, date } = req.params;

        const result = await getAgendaJour(doctor_phone, date);
        res.json(result);
    } catch (error) {
        console.error('[Secretariat] Erreur getAgendaJour:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

// Annuler RDV
async function annulerRDVController(req, res) {
    try {
        const { id } = req.params;
        const { motif } = req.body;
        const secretaire_phone = req.user.phone;

        const result = await annulerRDV(id, secretaire_phone, motif);
        res.json(result);
    } catch (error) {
        console.error('[Secretariat] Erreur annulerRDV:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Stats dashboard secrétariat
async function getDashboardStatsController(req, res) {
    try {
        const secretaire_phone = req.user.phone;

        // Récupérer partenaire_phone du secrétaire
        const secretaireResult = await pool.query(`
            SELECT partenaire_phone FROM secretaires WHERE phone = $1 AND is_active = TRUE
        `, [secretaire_phone]);

        if (secretaireResult.rows.length === 0) {
            return res.status(403).json({ success: false, message: 'Secrétaire non trouvé' });
        }

        const partenaire_phone = secretaireResult.rows[0].partenaire_phone;

        const result = await getDashboardStats(partenaire_phone);
        res.json(result);
    } catch (error) {
        console.error('[Secretariat] Erreur getDashboardStats:', error.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
}

module.exports = {
    ajouterFileAttenteController,
    appellerPatientController,
    terminerConsultationController,
    getFileAttenteController,
    bloquerAgendaController,
    getAgendaJourController,
    annulerRDVController,
    getDashboardStatsController
};
