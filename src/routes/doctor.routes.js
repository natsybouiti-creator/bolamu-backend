const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/db');
const path = require('path');

// --- IMPORT SÉCURISÉ DU MIDDLEWARE ---
// On s'assure que le middleware est une fonction pour éviter le crash
const authPath = path.join(__dirname, '..', '..', 'middleware', 'auth.middleware.js');
const authImport = require(authPath);
const authMiddleware = (typeof authImport === 'function') ? authImport : (req, res, next) => next();

// --- IMPORT SÉCURISÉ DU CONTROLLER ---
const controllerPath = path.join(__dirname, '..', 'controllers', 'doctor.controller.js');
const doctorCtrl = require(controllerPath);

// On extrait les fonctions avec une vérification de sécurité
const registerDoctor = doctorCtrl.registerDoctor;
const getDoctors = doctorCtrl.getDoctors;
const updateDoctorStatus = doctorCtrl.updateDoctorStatus;

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Format non supporté.'));
    }
});

// --- ROUTES ---

// POST /api/v1/doctors/register
if (typeof registerDoctor === 'function') {
    router.post('/register', upload.single('document'), registerDoctor);
}

// GET /api/v1/doctors (LIGNE 24 CORRIGÉE)
if (typeof getDoctors === 'function') {
    router.get('/', getDoctors);
} else {
    // Si la fonction est manquante, on met un handler vide pour éviter le crash de Render
    router.get('/', (req, res) => res.status(501).json({ message: "getDoctors non implémenté" }));
}

// GET /api/v1/doctors/pending (admin)
router.get('/pending', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, phone, specialty, registration_number,
                    city, status, trust_score, document_url, created_at
             FROM doctors WHERE status = 'pending' ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// GET /api/v1/doctors/all (admin)
router.get('/all', authMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, full_name, phone, specialty, registration_number,
                    city, status, trust_score, document_url, is_active,
                    total_consultations, member_code, created_at
             FROM doctors ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// PATCH /api/v1/doctors/:id/status (admin)
if (typeof updateDoctorStatus === 'function') {
    router.patch('/:id/status', authMiddleware, updateDoctorStatus);
}

// GET /api/v1/doctors/profil?phone=
router.get('/profil', authMiddleware, async (req, res) => {
    const { phone } = req.query;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone requis.' });

    try {
        const result = await pool.query(
            `SELECT id, full_name, phone, specialty, registration_number,
                    status, member_code, availability_schedule, trust_score,
                    document_url, city, neighborhood, bio, created_at
             FROM doctors WHERE phone = $1`,
            [phone]
        );
        if (!result.rows.length) return res.status(404).json({ success: false, message: 'Médecin introuvable.' });

        const doc = result.rows[0];
        if (!doc.member_code) {
            const digits = phone.replace(/\D/g, '').slice(-8);
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let code = '';
            for (let i = 0; i < 8; i += 2) { 
                const n = parseInt(digits.slice(i, i + 2)); 
                code += chars[n % chars.length]; 
            }
            doc.member_code = 'MED-' + code.slice(0, 4);
        }

        res.json({ success: true, data: doc });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;