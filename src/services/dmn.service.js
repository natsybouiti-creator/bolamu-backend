'use strict';
// ============================================================
// BOLAMU — DMN : Dossier Médical Numérique (BHP v1.2)
// ============================================================
const pool      = require('../config/db');
const bcrypt    = require('bcrypt');
const jwt       = require('jsonwebtoken');
const { normalizePhone } = require('../utils/phone');

if (!process.env.JWT_SECRET) throw new Error('[FATAL] JWT_SECRET non défini');
const JWT_SECRET      = process.env.JWT_SECRET;
const DMN_TOKEN_TYPE  = 'dmn_download';
const QR_TOKEN_TYPE   = 'dmn_qr';

// ─────────────────────────────────────────────────────────────
// getFullDossier(patient_phone)
// Agrège toutes les données DMN du patient (BHP conforme).
// Constantes stockées sur users (même table — pattern existant).
// ─────────────────────────────────────────────────────────────
async function getFullDossier(patient_phone) {
  const phone = normalizePhone(patient_phone);
  if (!phone) throw new Error('Numéro de téléphone invalide');

  // Identité + constantes (tout sur users)
  const userRes = await pool.query(
    `SELECT phone, full_name, gender, birth_date, city, created_at,
            groupe_sanguin, allergies, maladies_chroniques,
            antecedents_medicaux, traitements_en_cours,
            poids, taille,
            contact_urgence_nom, contact_urgence_phone, contact_urgence_lien,
            constantes_updated_at
     FROM users
     WHERE phone = $1 AND role = 'patient'`,
    [phone]
  );
  if (!userRes.rows.length) throw new Error('Patient introuvable');

  const u = userRes.rows[0];
  // BHP: initiales uniquement, jamais le nom complet en clair
  const parts     = (u.full_name || '').trim().split(/\s+/);
  const initiales = parts.map(p => (p[0] || '')).join('').toUpperCase().slice(0, 3);

  const [appointmentsRes, documentsRes, wellnessRes, accessRes] = await Promise.all([
    // 5 dernières consultations terminées
    pool.query(
      `SELECT a.id, a.appointment_date, a.appointment_time, a.status,
              d.full_name   AS doctor_name,
              d.specialty   AS doctor_specialty,
              d.phone       AS doctor_phone
       FROM appointments a
       LEFT JOIN doctors d ON d.id = a.doctor_id
       WHERE a.patient_phone = $1
         AND a.status IN ('complete','confirme')
       ORDER BY a.appointment_date DESC LIMIT 5`,
      [phone]
    ),
    // Documents du patient
    pool.query(
      `SELECT id, document_type, original_name, mimetype, file_size, created_at
       FROM documents
       WHERE uploaded_by = $1
       ORDER BY created_at DESC LIMIT 20`,
      [phone]
    ),
    // Wellness actions (Zora wellness — jamais health_records ici)
    pool.query(
      `SELECT action_type, zora_points, reference_id, created_at
       FROM wellness_actions
       WHERE patient_phone = $1
       ORDER BY created_at DESC LIMIT 10`,
      [phone]
    ),
    // 5 derniers accès DMN (traçabilité BHP)
    pool.query(
      `SELECT access_type, accessor_phone, accessed_at, details
       FROM dmn_access_log
       WHERE patient_phone = $1
       ORDER BY accessed_at DESC LIMIT 5`,
      [phone]
    )
  ]);

  return {
    identite: {
      phone:          u.phone,
      initiales,
      gender:         u.gender,
      birth_year:     u.birth_date ? new Date(u.birth_date).getFullYear() : null,
      city:           u.city,
      membre_depuis:  u.created_at
    },
    constantes: {
      groupe_sanguin:       u.groupe_sanguin       || null,
      allergies:            u.allergies            || null,
      maladies_chroniques:  u.maladies_chroniques  || null,
      antecedents_medicaux: u.antecedents_medicaux || null,
      traitements_en_cours: u.traitements_en_cours || null,
      poids:                u.poids                || null,
      taille:               u.taille               || null,
      contact_urgence_nom:   u.contact_urgence_nom  || null,
      contact_urgence_phone: u.contact_urgence_phone || null,
      contact_urgence_lien:  u.contact_urgence_lien  || null,
      updated_at:            u.constantes_updated_at || null
    },
    consultations:   appointmentsRes.rows,
    documents:       documentsRes.rows,
    wellness_actions: wellnessRes.rows,
    acces_recents:   accessRes.rows
  };
}

// ─────────────────────────────────────────────────────────────
// verifyPatientPassword(patient_phone, password, ip_address)
// Vérifie le mot de passe bcrypt, logue dans document_downloads,
// retourne un token temporaire JWT 15 min signé DMN_TOKEN_TYPE.
// ─────────────────────────────────────────────────────────────
async function verifyPatientPassword(patient_phone, password, ip_address) {
  const phone = normalizePhone(patient_phone);
  if (!phone) throw new Error('Numéro de téléphone invalide');

  const userRes = await pool.query(
    `SELECT password_hash FROM users WHERE phone = $1 AND role = 'patient'`,
    [phone]
  );

  if (!userRes.rows.length) {
    throw Object.assign(new Error('Identifiants incorrects'), { code: 'INVALID_CREDENTIALS' });
  }

  const match = await bcrypt.compare(password, userRes.rows[0].password_hash || '');

  if (!match) {
    pool.query(
      `INSERT INTO document_downloads (patient_phone, ip_address, status)
       VALUES ($1, $2, 'denied')`,
      [phone, ip_address || null]
    ).catch(() => {});
    throw Object.assign(new Error('Identifiants incorrects'), { code: 'INVALID_CREDENTIALS' });
  }

  const expires_at = new Date(Date.now() + 15 * 60 * 1000);
  const token = jwt.sign(
    { phone, type: DMN_TOKEN_TYPE },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  pool.query(
    `INSERT INTO document_downloads (patient_phone, ip_address, verified_at, status)
     VALUES ($1, $2, NOW(), 'verified')`,
    [phone, ip_address || null]
  ).catch(() => {});

  return { token, expires_at: expires_at.toISOString() };
}

// ─────────────────────────────────────────────────────────────
// verifyDmnToken(token)
// Vérifie le token DMN et rejette tout autre type de token JWT.
// ─────────────────────────────────────────────────────────────
function verifyDmnToken(token) {
  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded.type !== DMN_TOKEN_TYPE) {
    throw Object.assign(new Error('Token invalide'), { code: 'INVALID_TOKEN_TYPE' });
  }
  return decoded;
}

// ─────────────────────────────────────────────────────────────
// generateQRPayload(patient_phone)
// Payload BHP minimal signé JWT 24h.
// Jamais : nom complet, adresse, données non urgentes.
// ─────────────────────────────────────────────────────────────
async function generateQRPayload(patient_phone) {
  const phone = normalizePhone(patient_phone);
  if (!phone) throw new Error('Numéro de téléphone invalide');

  const userRes = await pool.query(
    `SELECT full_name, groupe_sanguin, allergies
     FROM users WHERE phone = $1 AND role = 'patient'`,
    [phone]
  );
  if (!userRes.rows.length) throw new Error('Patient introuvable');

  const u = userRes.rows[0];
  const parts        = (u.full_name || '').trim().split(/\s+/);
  const nom_initiales = parts.map(p => (p[0] || '')).join('').toUpperCase().slice(0, 3);

  const generated_at = new Date().toISOString();
  const expires_at   = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    patient_phone:      phone,
    nom_initiales,
    groupe_sanguin:      u.groupe_sanguin || null,
    allergies_critiques: u.allergies || null,
    acces_url:           `https://bolamu.co/patient/dossier?qr=1&p=${encodeURIComponent(phone)}`,
    generated_at,
    expires_at
  };

  // Signé pour intégrité — le frontend peut vérifier l'authenticité
  const signed = jwt.sign(
    Object.assign({ type: QR_TOKEN_TYPE }, payload),
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return { payload, signed };
}

// ─────────────────────────────────────────────────────────────
// logAccess(patient_phone, accessor_phone, access_type, details, ip)
// INSERT obligatoire sur TOUT accès DMN.
// accessor_phone peut être null (scan QR anonyme).
// ─────────────────────────────────────────────────────────────
async function logAccess(patient_phone, accessor_phone, access_type, details, ip_address) {
  const phone    = normalizePhone(patient_phone);
  const accessor = accessor_phone ? normalizePhone(accessor_phone) : null;

  await pool.query(
    `INSERT INTO dmn_access_log
       (patient_phone, accessor_phone, access_type, ip_address, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [phone, accessor, access_type, ip_address || null, JSON.stringify(details || {})]
  );
}

module.exports = {
  getFullDossier,
  verifyPatientPassword,
  verifyDmnToken,
  generateQRPayload,
  logAccess
};
