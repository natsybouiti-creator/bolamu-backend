const pool = require('../config/db');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const generateQRToken = async (req, res) => {
  const { phone } = req.user;
  try {
    const subCheck = await pool.query(
      `SELECT id FROM subscriptions WHERE patient_phone = $1 AND status = 'active' AND expires_at >= NOW() LIMIT 1`,
      [phone]
    );
    if (subCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: 'Aucun abonnement actif. Veuillez renouveler votre abonnement.' });
    }
    const configRes = await pool.query(
      `SELECT config_value FROM platform_config WHERE config_key = 'qr_token_ttl_seconds'`
    );
    const ttlSeconds = parseInt(configRes.rows[0]?.config_value || '300');
    await pool.query(
      `UPDATE qr_tokens SET used_at = NOW() WHERE user_phone = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [phone]
    );
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await pool.query(
      `INSERT INTO qr_tokens (user_phone, token, expires_at) VALUES ($1, $2, $3)`,
      [phone, token, expiresAt]
    );
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('QR_GENERATED', $1, 'qr_tokens', NULL, $2::jsonb)`,
      [phone, JSON.stringify({ expires_at: expiresAt })]
    );
    return res.status(200).json({ success: true, data: { token, expires_at: expiresAt, ttl_seconds: ttlSeconds, phone } });
  } catch (error) {
    console.error('generateQRToken error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

const verifyQRToken = async (req, res) => {
  const token = req.body?.token || req.query?.token;
  const partnerPhone = req.user.phone;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token manquant.' });
  }
  try {
    const tokenRes = await pool.query(
      `SELECT qt.*, u.full_name, u.phone as patient_phone, u.bolamu_id, u.zora_balance_visible_qr, u.photo_url FROM qr_tokens qt JOIN users u ON u.phone = qt.user_phone WHERE qt.token = $1`,
      [token]
    );
    if (tokenRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'QR Code invalide.' });
    }
    const qrToken = tokenRes.rows[0];
    if (new Date() > new Date(qrToken.expires_at)) {
      return res.status(410).json({ success: false, message: 'QR Code expiré. Demandez au patient d\'en générer un nouveau.' });
    }
    const subCheck = await pool.query(
      `SELECT id, plan, expires_at FROM subscriptions WHERE patient_phone = $1 AND status = 'active' AND expires_at >= NOW() LIMIT 1`,
      [qrToken.user_phone]
    );
    const hasActiveSub = subCheck.rows.length > 0;
    const sub = subCheck.rows[0] || null;
    const convRes = await pool.query(
      `SELECT discount_rate, monthly_cap_fcfa, partner_name FROM partner_conventions WHERE partner_phone = $1 AND status_new = 'actif'`,
      [partnerPhone]
    );
    const hasConvention = convRes.rows.length > 0;
    const convention = convRes.rows[0] || null;
    
    // Solde Zora uniquement si consentement patient activé
    let zoraBalance = null;
    if (qrToken.zora_balance_visible_qr) {
      const zoraRes = await pool.query(
        `SELECT COALESCE(SUM(points), 0) as balance FROM zora_ledger WHERE phone = $1`,
        [qrToken.user_phone]
      );
      zoraBalance = zoraRes.rows[0].balance;
    }
    
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('QR_SCANNED', $1, 'qr_tokens', NULL, $2::jsonb)`,
      [partnerPhone, JSON.stringify({ patient_phone: qrToken.user_phone, token })]
    );
    return res.status(200).json({
      success: true,
      data: {
        phone: qrToken.user_phone,
        full_name: qrToken.full_name,
        photo_url: qrToken.photo_url || null,
        bolamu_id: qrToken.bolamu_id,
        is_active: hasActiveSub,
        plan_nom: sub ? sub.plan : null,
        subscription_end: sub ? sub.expires_at : null,
        convention: convention,
        zora_balance: zoraBalance,
        token_expires_at: qrToken.expires_at
      }
    });
  } catch (error) {
    console.error('verifyQRToken error:', error);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─── GÉNÉRER QR CODE URGENCE PATIENT (patient authentifié) ─────────────────────
async function generatePatientQR(req, res) {
  const { phone } = req.user;
  try {
    const qrSecret = process.env.JWT_QR_SECRET || process.env.JWT_SECRET;
    const expiresAt = Date.now() + (1 * 60 * 60 * 1000); // 1 heure
    const token = jwt.sign(
      { patient_phone: phone, type: 'emergency_qr' },
      qrSecret,
      { expiresIn: '1h' }
    );
    const baseUrl = process.env.BASE_URL || 'https://bolamu.com';
    const emergencyUrl = `${baseUrl}/urgence?token=${token}`;
    return res.json({
      success: true,
      data: {
        emergency_url: emergencyUrl,
        expires_at: new Date(expiresAt).toISOString(),
        expires_in_hours: 1
      }
    });
  } catch (error) {
    console.error('[generatePatientQR] Erreur :', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── ACCÉDER DOSSIER URGENCE VIA QR (public, pas d'auth) ───────────────────
async function accessEmergencyDossier(req, res) {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token manquant.' });
  }
  try {
    // Vérifier si c'est un token UUID (nouveau système unifié) ou JWT (ancien système)
    let patientPhone;
    let isNewToken = false;
    let jwtExpiresAt = null;
    
    try {
      // Essayer d'abord le décodage JWT (ancien système)
      const qrSecret = process.env.JWT_QR_SECRET || process.env.JWT_SECRET;
      const decoded = jwt.verify(token, qrSecret);
      if (decoded.type !== 'emergency_qr') {
        return res.status(403).json({ success: false, message: 'Token invalide.' });
      }
      patientPhone = decoded.patient_phone;
      jwtExpiresAt = decoded.exp * 1000;
    } catch (jwtErr) {
      // Si JWT échoue, essayer le token UUID (nouveau système unifié)
      const tokenRes = await pool.query(
        `SELECT qt.*, u.full_name, u.phone as patient_phone, u.groupe_sanguin, u.allergies, u.traitements_en_cours, u.contact_urgence_nom, u.contact_urgence_phone 
         FROM qr_tokens qt 
         JOIN users u ON u.phone = qt.user_phone 
         WHERE qt.token = $1`,
        [token]
      );
      if (tokenRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'QR Code invalide ou expiré.' });
      }
      const qrToken = tokenRes.rows[0];
      if (new Date() > new Date(qrToken.expires_at)) {
        return res.status(410).json({ success: false, message: 'QR Code expiré. Demandez au patient d\'en générer un nouveau.' });
      }
      patientPhone = qrToken.patient_phone;
      isNewToken = true;
      
      const user = qrToken;
      const doctorResult = await pool.query(
        `SELECT d.full_name, d.specialty, d.phone 
         FROM doctors d
         INNER JOIN appointments a ON d.id = a.doctor_id
         WHERE a.patient_phone = $1
         ORDER BY a.appointment_date DESC
         LIMIT 1`,
        [patientPhone]
      );
      const treatingDoctor = doctorResult.rows.length > 0 ? doctorResult.rows[0] : null;
      
      // Audit log distinct pour accès urgence
      await pool.query(
        `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('QR_SCANNED_URGENCE', $1, 'qr_tokens', NULL, $2::jsonb)`,
        [req.ip || 'unknown', JSON.stringify({ patient_phone: patientPhone, token, method: 'public_scan' })]
      );
      
      // Log l'accès au dossier pour historique patient (dossier_access_log)
      const logDossierAccess = require('./consultation-report.controller').logDossierAccess;
      setImmediate(() => {
        logDossierAccess(patientPhone, 'emergency_qr', 'emergency', 'urgence_qr', req.ip);
      });
      
      // Notification WhatsApp au contact d'urgence si renseigné
      if (user.contact_urgence_phone) {
        const { sendAutoMessage } = require('../services/whatsapp.service');
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        const heureStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        
        setImmediate(async () => {
          try {
            await sendAutoMessage(
              user.contact_urgence_phone,
              'bolamu_urgence_dossier_consulte',
              [user.full_name, dateStr, heureStr]
            );
          } catch (wahaErr) {
            console.error('[accessEmergencyDossier] Notification urgence échouée:', wahaErr.message);
          }
        });
      }
      
      return res.json({
        success: true,
        data: {
          patient: {
            full_name: user.full_name,
            phone: user.phone,
            allergies: user.allergies || 'Non renseigné',
            groupe_sanguin: user.groupe_sanguin || 'Non renseigné',
            traitements_en_cours: user.traitements_en_cours || 'Non renseigné'
          },
          treating_doctor: treatingDoctor ? {
            full_name: treatingDoctor.full_name,
            specialty: treatingDoctor.specialty,
            phone: treatingDoctor.phone
          } : null,
          token_expires_at: qrToken.expires_at
        }
      });
    }
    
    // Ancien système JWT (fallback)
    const userResult = await pool.query(
      `SELECT full_name, phone, allergies, groupe_sanguin, traitements_en_cours, contact_urgence_nom, contact_urgence_phone FROM users WHERE phone = $1`,
      [patientPhone]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Patient introuvable.' });
    }
    const user = userResult.rows[0];
    const doctorResult = await pool.query(
      `SELECT d.full_name, d.specialty, d.phone 
       FROM doctors d
       INNER JOIN appointments a ON d.id = a.doctor_id
       WHERE a.patient_phone = $1
       ORDER BY a.appointment_date DESC
       LIMIT 1`,
      [patientPhone]
    );
    const treatingDoctor = doctorResult.rows.length > 0 ? doctorResult.rows[0] : null;
    
    // Audit log pour ancien système
    await pool.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('QR_SCANNED_URGENCE', $1, 'users', NULL, $2::jsonb)`,
      [req.ip || 'unknown', JSON.stringify({ patient_phone: patientPhone, method: 'jwt_fallback' })]
    );
    
    // Log l'accès au dossier pour historique patient (dossier_access_log)
    const logDossierAccess = require('./consultation-report.controller').logDossierAccess;
    setImmediate(() => {
      logDossierAccess(patientPhone, 'emergency_qr', 'emergency', 'urgence_qr', req.ip);
    });
    
    // Notification WhatsApp pour ancien système
    if (user.contact_urgence_phone) {
      const { sendAutoMessage } = require('../services/whatsapp.service');
      const now = new Date();
      const dateStr = now.toLocaleDateString('fr-FR');
      const heureStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      
      setImmediate(async () => {
        try {
          await sendAutoMessage(
            user.contact_urgence_phone,
            'bolamu_urgence_dossier_consulte',
            [user.full_name, dateStr, heureStr]
          );
        } catch (wahaErr) {
          console.error('[accessEmergencyDossier] Notification urgence échouée:', wahaErr.message);
        }
      });
    }
    
    return res.json({
      success: true,
      data: {
        patient: {
          full_name: user.full_name,
          phone: user.phone,
          allergies: user.allergies || 'Non renseigné',
          groupe_sanguin: user.groupe_sanguin || 'Non renseigné',
          traitements_en_cours: user.traitements_en_cours || 'Non renseigné'
        },
        treating_doctor: treatingDoctor ? {
          full_name: treatingDoctor.full_name,
          specialty: treatingDoctor.specialty,
          phone: treatingDoctor.phone
        } : null,
        token_expires_at: jwtExpiresAt
      }
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(410).json({ success: false, message: 'QR code expiré.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ success: false, message: 'Token invalide.' });
    }
    console.error('[accessEmergencyDossier] Erreur :', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

// ─── ACCÉDER AU PROFIL PUBLIC VIA QR (public, pas d'auth) ──────────────────
// Contrairement à /urgence (dossier médical), cette route n'expose aucune
// donnée médicale ni le solde Zora — juste de quoi identifier visuellement
// l'adhérent (avatar, nom, ID Bolamu, statut de compte).
async function accessPublicProfil(req, res) {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token manquant.' });
  }
  try {
    const tokenRes = await pool.query(
      `SELECT qt.expires_at, u.phone as patient_phone, u.full_name, u.photo_url, u.bolamu_id, u.is_active
       FROM qr_tokens qt
       JOIN users u ON u.phone = qt.user_phone
       WHERE qt.token = $1`,
      [token]
    );

    if (tokenRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'QR Code invalide.' });
    }

    const row = tokenRes.rows[0];
    if (new Date() > new Date(row.expires_at)) {
      return res.status(410).json({ success: false, message: 'QR Code expiré. Demandez à l\'adhérent d\'en générer un nouveau.' });
    }

    let statut = 'inactif';
    if (row.is_active === false) {
      statut = 'suspendu';
    } else {
      const subRes = await pool.query(
        `SELECT status, expires_at FROM subscriptions WHERE patient_phone = $1 ORDER BY id DESC LIMIT 1`,
        [row.patient_phone]
      );
      if (subRes.rows.length === 0) {
        statut = 'inactif';
      } else {
        const sub = subRes.rows[0];
        if (sub.status === 'active' && new Date(sub.expires_at) >= new Date()) {
          statut = 'actif';
        } else if (sub.status === 'suspended') {
          statut = 'suspendu';
        } else if (sub.status === 'pending') {
          statut = 'en_attente';
        } else {
          statut = 'expire';
        }
      }
    }

    return res.json({
      success: true,
      data: {
        full_name: row.full_name,
        photo_url: row.photo_url || null,
        bolamu_id: row.bolamu_id || null,
        statut
      }
    });
  } catch (error) {
    console.error('[accessPublicProfil] Erreur :', error.message);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
}

module.exports = { generateQRToken, verifyQRToken, generatePatientQR, accessEmergencyDossier, accessPublicProfil };