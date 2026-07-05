const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth.middleware');
const { normalizePhone } = require('../utils/phone');
const patientController = require('../controllers/patient.controller');
const bcrypt = require('bcrypt');
const idempotencyMiddleware = require('../middleware/idempotency');
const { upgradeAbonnement } = require('../services/prorata.service');
const { calculerScoreBolamu } = require('../services/scoreBolamu.service');
const { encourageMember, calculateBadges } = require('../services/communityService');
const { uploadToCloudinary } = require('../utils/cloudinary');
const multer = require('multer');
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Middleware pour gérer les erreurs multer
const handleMulterError = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 5MB)' });
  }
  next(err);
};

const register = patientController.registerPatient || ((req, res) => {
    res.status(501).json({ success: false, message: "Fonction d'inscription non configurée" });
});

const subscription = patientController.getSubscription || ((req, res) => {
    res.status(501).json({ success: false, message: "Fonction d'abonnement non configurée" });
});

// --- ROUTES PUBLIQUES ---
router.post('/register', register);

// --- ROUTES PROTÉGÉES ---
router.get('/subscription', authMiddleware, subscription);

// Créer un abonnement (POST /api/v1/patients/subscription)
router.post('/subscription', authMiddleware, patientController.createSubscription);

// Modifier mot de passe (PATCH /api/v1/patients/password)
router.patch('/password', authMiddleware, patientController.changePassword);

// Upgrade abonnement (PATCH /api/v1/patients/subscription/upgrade)
router.patch('/subscription/upgrade', authMiddleware, idempotencyMiddleware('/subscription/upgrade'), async (req, res) => {
    const { nouveau_plan, coupon_code } = req.body;
    const patientPhone = req.user.phone;

    // Validation montant côté serveur uniquement (TC-113) - ignorer montant envoyé par le client
    // Le montant sera calculé par calculProrata dans upgradeAbonnement

    if (!nouveau_plan) {
        return res.status(400).json({ success: false, message: 'Nouveau plan requis.' });
    }

    try {
        const result = await upgradeAbonnement(patientPhone, nouveau_plan, coupon_code);
        return res.json(result);
    } catch (error) {
        console.error('[upgradeSubscription]', error.message);
        return res.status(400).json({ success: false, message: error.message });
    }
});

router.get('/profil', authMiddleware, async (req, res) => {
    try {
        const phone = normalizePhone(req.user.phone);

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

router.get('/check-subscription', authMiddleware, async (req, res) => {
    try {
        const phone = normalizePhone(req.user.phone);

        const result = await pool.query(
            `SELECT status, plan, expires_at 
             FROM subscriptions 
             WHERE patient_phone = $1 AND status = 'active' AND expires_at > NOW() 
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

router.post('/change-password', authMiddleware, async (req, res) => {
  const phone = req.user.phone;
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ success: false, message: 'Champs manquants' });
  if (new_password.length < 6) return res.status(400).json({ success: false, message: 'Le nouveau mot de passe doit faire au moins 6 caractères' });
  try {
    const result = await pool.query(`SELECT password_hash FROM users WHERE phone = $1`, [phone]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Compte introuvable' });
    const valid = await bcrypt.compare(old_password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Ancien mot de passe incorrect' });
    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query(`UPDATE users SET password_hash = $1 WHERE phone = $2`, [newHash, phone]);
    res.json({ success: true, message: 'Mot de passe modifié avec succès' });
  } catch(e) {
    console.error('[change-password]', e.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Requête trop courte (min 2 caractères)' });
    }

    const query = q.trim();
    const normalizedQuery = query.replace(/\+/g, '');
    const result = await pool.query(
      `SELECT u.phone, u.full_name, u.bolamu_id as account_number, 
              u.member_code, s.plan as plan_nom, s.status as subscription_status, u.is_active
       FROM users u
       LEFT JOIN subscriptions s ON u.phone = s.patient_phone AND s.status = 'active' AND s.expires_at > NOW()
       WHERE u.role = 'patient' 
         AND (REPLACE(u.phone, '+', '') ILIKE $1 
              OR u.full_name ILIKE $1 
              OR u.bolamu_id ILIKE $1
              OR u.member_code ILIKE $1)
       ORDER BY u.full_name
       LIMIT 10`,
      [`%${normalizedQuery}%`]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('[patients-search]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/patient/score-bienetre - Score Bolamu du patient connecté
router.get('/score-bienetre', authMiddleware, async (req, res) => {
  try {
    const patientPhone = req.user.phone;
    const scoreData = await calculerScoreBolamu(patientPhone);
    res.json({ success: true, data: scoreData });
  } catch (error) {
    console.error('[score-bienetre]', error.message);
    res.status(500).json({ success: false, message: 'Erreur lors du calcul du score' });
  }
});

// GET /api/patient/consultations/recentes - 4 dernières consultations du patient
router.get('/consultations/recentes', authMiddleware, async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const now = new Date();

    const result = await pool.query(
      `SELECT c.id, c.started_at, c.status,
              d.full_name as doctor_name, d.specialty
       FROM consultations c
       LEFT JOIN doctors d ON d.phone = c.doctor_phone
       WHERE c.patient_phone = $1
       ORDER BY c.started_at DESC
       LIMIT 4`,
      [phone]
    );

    // Statut SSP/hors-catalogue des médicaments prescrits pendant chaque
    // consultation — pour que le patient voie ce qui est gratuit vs à sa charge
    // (migration_059). is_ssp est calculé une seule fois à la prescription,
    // jamais recalculé ici.
    // Système A (prescriptions) est désormais canonique — ordonnances/
    // ordonnance_items ne sont plus alimentées par le médecin (voir
    // ARCHITECTURE_SOINS_BOLAMU.md §3). Jointure via consultations.appointment_id =
    // prescriptions.appointment_id (migration_061 — les deux référencent
    // désormais appointments(id) sémantiquement, plus par coïncidence).
    const consultationIds = result.rows.map(c => c.id);
    let itemsByConsultation = {};
    if (consultationIds.length > 0) {
      const itemsResult = await pool.query(
        `SELECT c.id AS consultation_id, p.medications, p.is_ssp
         FROM consultations c
         JOIN prescriptions p ON p.appointment_id = c.appointment_id
         WHERE c.id = ANY($1)`,
        [consultationIds]
      );
      itemsByConsultation = itemsResult.rows.reduce((acc, row) => {
        (acc[row.consultation_id] = acc[row.consultation_id] || []).push({
          medicament: row.medications,
          is_ssp: row.is_ssp
        });
        return acc;
      }, {});
    }

    const consultations = result.rows.map(c => {
      const startedAt = new Date(c.started_at);
      const isPast = startedAt < now;
      return {
        id: c.id,
        doctor_name: c.doctor_name || 'Médecin',
        specialty: c.specialty || 'Généraliste',
        date: startedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }),
        status: isPast ? 'Terminée' : 'À venir',
        medications: itemsByConsultation[c.id] || []
      };
    });

    res.json({ success: true, data: consultations });
  } catch (err) {
    console.error('[consultations-recentes]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/v1/patients/leaderboard/weekly - Classement hebdomadaire
router.get('/leaderboard/weekly', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.phone, u.full_name, u.first_name, u.last_name, u.photo_url,
              SUM(zl.points) as weekly_points
       FROM users u
       JOIN zora_ledger zl ON zl.phone = u.phone
       WHERE u.role = 'patient'
         AND u.is_active = true
         AND zl.earned_at >= date_trunc('week', NOW())
       GROUP BY u.phone, u.full_name, u.first_name, u.last_name, u.photo_url
       ORDER BY weekly_points DESC
       LIMIT 50`
    );

    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      phone: row.phone,
      full_name: row.full_name,
      first_name: row.first_name,
      last_name: row.last_name,
      photo_url: row.photo_url,
      weekly_points: parseInt(row.weekly_points) || 0
    }));

    res.json({ success: true, data: leaderboard });
  } catch (err) {
    console.error('[leaderboard-weekly]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/v1/patients/encourage - Envoyer un encouragement
router.post('/encourage', authMiddleware, async (req, res) => {
  try {
    const { target_phone } = req.body;
    const senderPhone = normalizePhone(req.user.phone);

    if (!target_phone) {
      return res.status(400).json({ success: false, message: 'target_phone requis' });
    }

    const result = await encourageMember(senderPhone, target_phone);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[encourage]', err.message);
    if (err.message === 'ALREADY_ENCOURAGED_TODAY') {
      return res.status(429).json({ success: false, message: 'Vous avez déjà encouragé ce membre aujourd\'hui' });
    }
    if (err.message === 'TARGET_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Destinataire introuvable' });
    }
    if (err.message === 'TARGET_NOT_PATIENT') {
      return res.status(400).json({ success: false, message: 'TARGET_NOT_PATIENT' });
    }
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/v1/patients/encouragements/received - Encouragements reçus
router.get('/encouragements/received', authMiddleware, async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);

    const result = await pool.query(
      `SELECT le.from_phone, u.full_name, u.first_name, u.photo_url, le.created_at
       FROM leaderboard_encouragements le
       JOIN users u ON u.phone = le.from_phone
       WHERE le.target_phone = $1
       ORDER BY le.created_at DESC
       LIMIT 10`,
      [phone]
    );

    const encouragements = result.rows.map(row => ({
      from_phone: row.from_phone,
      sender_name: row.full_name || row.first_name || 'Un membre',
      photo_url: row.photo_url,
      created_at: row.created_at
    }));

    res.json({ success: true, data: encouragements });
  } catch (err) {
    console.error('[encouragements-received]', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// POST /api/v1/patients/photo - Upload photo de profil
router.post('/photo', authMiddleware, upload.single('photo'), handleMulterError, async (req, res) => {
  try {
    console.log('[patient-photo] req.file:', req.file ? 'present' : 'missing');
    console.log('[patient-photo] req.user:', req.user ? 'present' : 'missing');
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucune photo fournie' });
    }

    const phone = normalizePhone(req.user.phone);
    console.log('[patient-photo] phone:', phone);

    // Upload vers Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'bolamu/photos', {
      public_id: `patient_${phone}_${Date.now()}`,
      transformation: { width: 400, height: 400, crop: 'fill' }
    });

    console.log('[patient-photo] uploadResult:', uploadResult.secure_url);

    // Mettre à jour la table users
    await pool.query(
      'UPDATE users SET photo_url = $1 WHERE phone = $2',
      [uploadResult.secure_url, phone]
    );

    res.json({ success: true, photo_url: uploadResult.secure_url });
  } catch (err) {
    console.error('[patient-photo] ERROR:', err);
    console.error('[patient-photo] ERROR message:', err.message);
    console.error('[patient-photo] ERROR stack:', err.stack);
    
    // Gestion spécifique erreur multer LIMIT_FILE_SIZE
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 5MB)' });
    }
    
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// PATCH /api/v1/patients/profil-social - Mettre à jour le profil social
router.patch('/profil-social', authMiddleware, async (req, res) => {
  try {
    const phone = normalizePhone(req.user.phone);
    const { bio, city, statut_disponibilite, interets } = req.body;

    // Validation statut_disponibilite
    const statutsAutorises = ['Cherche partenaire de sport', 'Ouvert à rejoindre une équipe', 'Non précisé'];
    if (statut_disponibilite && !statutsAutorises.includes(statut_disponibilite)) {
      return res.status(400).json({ success: false, message: 'Statut de disponibilité invalide' });
    }

    // Validation bio (max 300 caractères)
    if (bio && bio.length > 300) {
      return res.status(400).json({ success: false, message: 'Bio trop longue (max 300 caractères)' });
    }

    // Construction de la requête UPDATE dynamique
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (bio !== undefined) {
      updates.push(`bio = $${paramCount++}`);
      values.push(bio || null);
    }

    if (city !== undefined) {
      updates.push(`city = $${paramCount++}`);
      values.push(city || null);
    }

    if (statut_disponibilite !== undefined) {
      updates.push(`statut_disponibilite = $${paramCount++}`);
      values.push(statut_disponibilite || null);
    }

    if (interets !== undefined) {
      updates.push(`interets = $${paramCount++}`);
      values.push(interets || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'Aucun champ à mettre à jour' });
    }

    values.push(phone);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE phone = $${paramCount}`;

    await pool.query(query, values);

    res.json({ success: true, message: 'Profil social mis à jour' });
  } catch (err) {
    console.error('[profil-social] ERROR:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// GET /api/v1/patients/profil-social/:phone - Lire le profil social (public)
router.get('/profil-social/:phone', async (req, res) => {
  try {
    const targetPhone = normalizePhone(req.params.phone);

    const result = await pool.query(
      `SELECT bio, city, statut_disponibilite, interets, photo_url, 
              full_name, first_name, last_name, created_at
       FROM users 
       WHERE phone = $1`,
      [targetPhone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const user = result.rows[0];

    // Stats Zora (réutilise requête existante)
    const zoraResult = await pool.query(
      `SELECT COALESCE(SUM(points), 0) as zora_gagnes
       FROM zora_ledger
       WHERE phone = $1
         AND earned_at >= date_trunc('week', NOW())`,
      [targetPhone]
    );
    const zora_gagnes = parseInt(zoraResult.rows[0]?.zora_gagnes) || 0;

    // Stats Streak (réutilise requête existante)
    const streakResult = await pool.query(
      'SELECT current_streak FROM user_streaks WHERE phone = $1',
      [targetPhone]
    );
    const streak = streakResult.rows[0]?.current_streak || 0;

    // Stats Événements (réutilise requête existante)
    const eventsResult = await pool.query(
      `SELECT COUNT(*) as count
       FROM elonga_registrations
       WHERE phone = $1
         AND status IN ('registered', 'checked_in')`,
      [targetPhone]
    );
    const evenements = parseInt(eventsResult.rows[0]?.count) || 0;

    const stats = {
      zora_gagnes,
      streak,
      evenements
    };

    // Calcul des badges
    const badges = await calculateBadges(targetPhone);

    res.json({
      success: true,
      data: {
        bio: user.bio,
        city: user.city,
        statut_disponibilite: user.statut_disponibilite,
        interets: user.interets,
        photo_url: user.photo_url,
        full_name: user.full_name,
        first_name: user.first_name,
        last_name: user.last_name,
        badges,
        stats
      }
    });
  } catch (err) {
    console.error('[profil-social] ERROR:', err.message);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;