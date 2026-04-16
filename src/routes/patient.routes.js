const express = require('express');
const router = express.Router();
const path = require('path');
const pool = require('../config/db');

// CORRECTION : On déstructure pour récupérer la fonction authMiddleware dans l'objet exporté
const { authMiddleware } = require('../middleware/auth.middleware');

// Import du contrôleur
const patientController = require('../controllers/patient.controller');

// --- SÉCURITÉ ANTI-CRASH (Vérification des fonctions) ---
const register = patientController.registerPatient || ((req, res) => {
    console.error("Erreur: registerPatient est undefined dans le contrôleur");
    res.status(501).json({ success: false, message: "Fonction d'inscription non configurée" });
});

const subscription = patientController.getSubscription || ((req, res) => {
    console.error("Erreur: getSubscription est undefined dans le contrôleur");
    res.status(501).json({ success: false, message: "Fonction d'abonnement non configurée" });
});

// --- ROUTES PUBLIQUES ---
router.post('/register', register);

// --- ROUTES PROTÉGÉES (Nécessitent un Token) ---
router.get('/subscription', authMiddleware, subscription);

// Récupérer le profil complet (Logique métier préservée)
router.get('/profil', authMiddleware, async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });

        const result = await pool.query(
            `SELECT phone, full_name, gender, birth_date, city, neighborhood, bolamu_id, is_active, created_at 
             FROM users 
             WHERE phone = $1 AND role = 'patient'`,
            [phone]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient introuvable' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error('[patient-profil]', err.message);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération du profil' });
    }
});

// Vérification rapide du statut d'abonnement (Offres Collectives)
router.get('/check-subscription', authMiddleware, async (req, res) => {
    try {
        const { phone } = req.query;
        if (!phone) return res.status(400).json({ success: false, message: 'Numéro de téléphone requis' });

        const result = await pool.query(
            `SELECT status, plan, expires_at 
             FROM subscriptions 
             WHERE phone = $1 AND status = 'active' AND expires_at > NOW() 
             ORDER BY expires_at DESC LIMIT 1`,
            [phone]
        );

        res.json({
            success: true,
            has_active_subscription: result.rows.length > 0,
            subscription: result.rows[0] || null
        });
    } catch (err) {
        console.error('[check-subscription]', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur' });
    }
});

module.exports = router;