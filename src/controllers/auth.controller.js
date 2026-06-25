const pool = require('../config/db');
const logger = require('../config/logger');
const { generateOtp, simulateSendOtp } = require('../utils/otp');
const { hashText } = require('../utils/hash');
const { normalizePhone } = require('../utils/phone');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { uploadToCloudinary } = require('../utils/cloudinary');
const { buildWameLink } = require('../services/wame.service');
const { sendOnboardingLink } = require('../utils/sendOnboardingLink');

if (!process.env.JWT_SECRET) {
    throw new Error('[FATAL] JWT_SECRET non défini. Configurez cette variable dans Render.');
}
const JWT_SECRET = process.env.JWT_SECRET;
const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '7d';

function generatePassword(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// ============================================================
// 1. DEMANDER OTP
// ============================================================
async function requestOtp(req, res) {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Numéro requis" });
    
    // Normalisation du numéro
    const normalizedPhone = normalizePhone(phone);

    const adminCheck = await pool.query(`SELECT role FROM users WHERE phone = $1`, [normalizedPhone]).catch(() => ({ rows: [] }));
    if (adminCheck.rows[0]?.role === 'admin') {
        return res.status(403).json({ success: false, message: "Accès non autorisé. Utilisez le portail administrateur.", redirectUrl: "/admin/login.html" });
    }

    const otpCode = generateOtp();
    const hashedOtp = hashText(otpCode);
    const expiresAt = new Date(Date.now() + 10 * 60000);

    try {
        await pool.query(
            `INSERT INTO otp_codes (phone, hashed_otp, expires_at, attempts) VALUES ($1, $2, $3, 0)
             ON CONFLICT (phone) DO UPDATE SET hashed_otp = $2, expires_at = $3, attempts = 0`,
            [normalizedPhone, hashedOtp, expiresAt]
        );
        // TODO: Créer template bolamu_code_acces dans Meta pour OTP réel
        // Pour le test, utilise simulateSendOtp (affiche dans les logs)
        simulateSendOtp(normalizedPhone, otpCode);
        return res.status(200).json({ success: true, message: "OTP envoyé" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Erreur génération OTP" });
    }
}

// ============================================================
// 2. VERIFY OTP
// ============================================================
async function verifyOtp(req, res) {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: "Téléphone et OTP requis" });
    
    // Normalisation du numéro
    const normalizedPhone = normalizePhone(phone);

    try {
        const result = await pool.query(`SELECT * FROM otp_codes WHERE phone = $1`, [normalizedPhone]);
        if (result.rows.length === 0) return res.status(404).json({ success: false, message: "Aucun OTP trouvé" });

        const record = result.rows[0];
        if (new Date() > new Date(record.expires_at)) return res.status(400).json({ success: false, message: "OTP expiré" });
        if (record.attempts >= 5) return res.status(403).json({ success: false, message: "Trop de tentatives" });

        const hashedInput = hashText(String(otp));
        if (hashedInput !== record.hashed_otp) {
            await pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1`, [normalizedPhone]);
            return res.status(401).json({ success: false, message: "Code incorrect" });
        }

        await pool.query(`DELETE FROM otp_codes WHERE phone = $1`, [normalizedPhone]);
        return res.status(200).json({ success: true, message: "OTP validé" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "Erreur serveur" });
    }
}

// ============================================================
// 3. LOGIN (MOT DE PASSE)
// ============================================================
async function login(req, res) {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, message: 'Téléphone et mot de passe requis.' });
    
    const normalizedPhone = normalizePhone(phone);
    
    try {
        const userResult = await pool.query(`SELECT * FROM users WHERE phone = $1`, [normalizedPhone]);
        if (!userResult.rows.length) return res.status(404).json({ success: false, message: 'Compte introuvable.' });
        
        const user = userResult.rows[0];
        
        if (user.role === 'admin') return res.status(403).json({ success: false, message: 'Accès non autorisé. Utilisez le portail administrateur.', redirectUrl: '/admin/login.html' });
        if (user.banned) return res.status(403).json({ success: false, message: 'Compte suspendu. Contactez le support.' });
        
        const storedHash = user.password_hash || user.password;
        if (!storedHash) return res.status(401).json({ success: false, message: 'Mot de passe non configuré. Contactez votre agent Bolamu.' });
        
        const validPassword = await bcrypt.compare(password, storedHash);
        if (!validPassword) return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });

        // Access token (15min)
        const accessToken = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRES }
        );

        // Refresh token (7 jours)
        const refreshToken = crypto.randomBytes(64).toString('hex');
        const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 jours

        // Stocker le refresh token
        await pool.query(
            `INSERT INTO refresh_tokens (phone, token_hash, expires_at, is_revoked)
             VALUES ($1, $2, $3, FALSE)
             ON CONFLICT (phone) DO UPDATE SET token_hash = $2, expires_at = $3, is_revoked = FALSE`,
            [normalizedPhone, refreshTokenHash, expiresAt]
        );
        
        let redirectUrl = '/login.html';
        switch (user.role) {
            case 'patient':     redirectUrl = '/patient/dashboard.html'; break;
            case 'doctor':      redirectUrl = '/medecin/dashboard.html'; break;
            case 'pharmacie':   redirectUrl = '/pharmacie/dashboard.html'; break;
            case 'laboratoire': redirectUrl = '/laboratoire/dashboard.html'; break;
            case 'company_rh':  redirectUrl = '/rh/dashboard.html'; break;
        }
        
        return res.status(200).json({
            success: true,
            message: 'Connexion réussie',
            accessToken,
            refreshToken,
            role: user.role,
            phone: normalizedPhone,
            redirectUrl,
            must_change_password: user.password_must_change || false
        });
    } catch (err) {
        console.error('[login]', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ============================================================
// 4. FORGOT PASSWORD
// ============================================================
async function forgotPassword(req, res) {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Téléphone requis.' });
    
    const normalizedPhone = normalizePhone(phone);
    
    try {
        const userResult = await pool.query(`SELECT * FROM users WHERE phone = $1`, [normalizedPhone]);
        if (!userResult.rows.length) return res.status(404).json({ success: false, message: 'Compte introuvable.' });
        
        const newPassword = generatePassword();
        const passwordHash = await bcrypt.hash(newPassword, 10);
        
        await pool.query(
            `UPDATE users SET password_hash = $1, password_must_change = true WHERE phone = $2`,
            [passwordHash, normalizedPhone]
        );
        
        try {
            await sendWhatsAppTemplate(normalizedPhone, 'bolamu_code_acces', [newPassword]);
        } catch (whatsappError) {
            console.warn('[WhatsApp] Envoi mot de passe échoué (non bloquant)', { phone: normalizedPhone, error: whatsappError.message });
        }
        // TODO: supprimer sendBolamuSms après validation WhatsApp
        // await sendBolamuSms(normalizedPhone, `Bolamu - Votre nouveau mot de passe temporaire : ${newPassword}. Connectez-vous et changez-le dans votre profil.`);
        
        return res.status(200).json({ success: true, message: 'Nouveau mot de passe envoyé par WhatsApp.' });
    } catch (err) {
        console.error('[forgotPassword]', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ============================================================
// 5. REGISTER PATIENT
// ============================================================
async function registerPatient(req, res) {
    const { phone, first_name, last_name, full_name, gender, age, city, neighborhood, niu, id_card_file_id, documents_file_ids, cgu_accepted, photoData } = req.body;

    if (!phone || !first_name || !last_name) {
        return res.status(400).json({ success: false, message: "Prénom, nom et téléphone sont obligatoires." });
    }
    
    // Normalisation du numéro
    const normalizedPhone = normalizePhone(phone);

    try {
        const existing = await pool.query(`SELECT id FROM users WHERE phone = $1`, [normalizedPhone]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: "Un compte existe déjà avec ce numéro." });
        }

        const maxResult = await pool.query(`SELECT MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)) FROM users WHERE role = 'patient' AND member_code IS NOT NULL`);
        const nextNum = (maxResult.rows[0].max || 0) + 1;
        const member_code = `BLM-${String(nextNum).padStart(5, '0')}`;
        const finalName = full_name || `${first_name} ${last_name}`.trim();

        const initialPassword = generatePassword();
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        logger.info('[REGISTER] Compte créé', { phone: normalizedPhone });

        // Upload photo sur Cloudinary si fournie
        let photoUrl = null;
        if (photoData) {
            try {
                const base64Data = photoData.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                const uploadResult = await uploadToCloudinary(buffer, 'bolamu/photos', {
                    public_id: `patient_${normalizedPhone}_${Date.now()}`,
                    transformation: { width: 400, height: 400, crop: 'fill' }
                });
                photoUrl = uploadResult.secure_url;
            } catch (photoErr) {
                console.error('[CLOUDINARY UPLOAD REGISTER]', photoErr.message);
                // Ne pas bloquer l'inscription si l'upload échoue
            }
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const insertResult = await client.query(
                `INSERT INTO users (
                    phone, role, full_name, first_name, last_name,
                    gender, age, city, neighborhood, niu, documents_file_ids,
                    member_code, cgu_accepted, cgu_accepted_at,
                    is_active, trust_score, password_hash, photo_url, temp_password_must_change, created_at
                 ) VALUES (
                    $1, 'patient', $2, $3, $4,
                    $5, $6, $7, $8, $9, $10,
                    $11, $12, NOW(),
                    false, 80, $13, $14, true, NOW()
                 ) RETURNING id, phone, role, full_name, member_code, is_active, banned`,
                [normalizedPhone, finalName, first_name, last_name, gender || null, age || null, city || null, neighborhood || null, niu || null, JSON.stringify({ id_card: id_card_file_id || (documents_file_ids && documents_file_ids.id_card) || null }), member_code, cgu_accepted || false, passwordHash, photoUrl]
            );

            const user = insertResult.rows[0];

            // Mettre à jour owner_id des documents uploadés avant inscription
            await client.query(
                `UPDATE documents 
                 SET owner_id = $1 
                 WHERE uploaded_by = $2 AND owner_id IS NULL`,
                [user.id, normalizedPhone]
            );

            await client.query('COMMIT');

            try {
                await sendWhatsAppTemplate(normalizedPhone, 'bolamu_bienvenue_patient_v4', [`${first_name} ${last_name}`.trim()]);
            } catch (whatsappError) {
                console.warn('[WhatsApp] Envoi bienvenue échoué (non bloquant)', { phone: normalizedPhone, error: whatsappError.message });
            }
            await sendOnboardingLink(normalizedPhone, `${first_name} ${last_name}`.trim(), 'patient');
            // TODO: supprimer sendBolamuSms après validation WhatsApp
            // await sendBolamuSms(normalizedPhone, `Bolamu - Bienvenue ! Votre mot de passe : ${initialPassword}. Gardez-le précieusement.`);

            const wameLink = buildWameLink(normalizedPhone, 'inscription_mdp', {
              prenom: first_name,
              phone: normalizedPhone,
              mdp: initialPassword
            });

            const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });

            await pool.query(
                `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.patient', $1, 'users', $2, $3::jsonb)`,
                [normalizedPhone, user.id, JSON.stringify({ member_code, photo_url: photoUrl })]
            ).catch((err) => logger.error('[registerPatient] Audit log error:', err.message));

            return res.status(201).json({ success: true, message: "Compte patient créé avec succès", token, phone: normalizedPhone, role: user.role, member_code: user.member_code, whatsapp_link: wameLink });
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: "Ce numéro est déjà utilisé." });
        }
        console.error('[registerPatient]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
}

// ============================================================
// 5. REGISTER DOCTOR
// ============================================================
async function registerDoctor(req, res) {
    const {
        phone, full_name, first_name, last_name,
        specialty, registration_number, order_country,
        country_of_residence, consultation_languages,
        is_international, city, document_file_id, documents_file_ids, trust_score, cgu_accepted,
        etablissement_nom, etablissement_adresse, etablissement_lat, etablissement_lng, etablissement_ville
    } = req.body;

    if (!phone || !full_name || !specialty || !registration_number) {
        return res.status(400).json({ success: false, message: "Téléphone, nom, spécialité et numéro d'ordre sont obligatoires." });
    }
    
    // Normalisation du numéro
    const normalizedPhone = normalizePhone(phone);

    try {
        const existing = await pool.query(`SELECT id FROM users WHERE phone = $1`, [normalizedPhone]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: "Un compte existe déjà avec ce numéro." });
        }

        const maxResult = await pool.query(`SELECT MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)) FROM users WHERE role = 'doctor' AND member_code IS NOT NULL`);
        const nextNum = (maxResult.rows[0].max || 0) + 1;
        const member_code = `MED-${String(nextNum).padStart(5, '0')}`;
        const score = trust_score || (registration_number ? 60 : 30);
        const is_active = false;
        const autoStatus = score >= 80 ? 'verified' : 'pending';

        const initialPassword = generatePassword();
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        logger.info('[REGISTER] Compte créé', { phone: normalizedPhone });

        let newUser;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            newUser = await client.query(
                `INSERT INTO users (
                    phone, role, full_name, first_name, last_name,
                    specialty, registration_number, order_country,
                    country_of_residence, consultation_languages,
                    is_international, city,
                    trust_score, member_code, cgu_accepted, cgu_accepted_at,
                    is_active, password_hash, documents_file_ids, created_at,
                    etablissement_nom, etablissement_adresse, etablissement_lat, etablissement_lng, etablissement_ville
                 ) VALUES (
                    $1, 'doctor', $2, $3, $4,
                    $5, $6, $7,
                    $8, $9,
                    $10, $11,
                    $12, $13, $14, NOW(),
                    $15, $16, $17, NOW(),
                    $18, $19, $20, $21, $22
                 ) RETURNING id, phone, role, full_name, member_code, is_active, banned`,
                [
                    normalizedPhone, full_name, first_name || null, last_name || null,
                    specialty, registration_number, order_country || 'Congo-Brazzaville',
                    country_of_residence || 'Congo-Brazzaville', consultation_languages || 'Français',
                    is_international || false, city || null,
                    score, member_code, cgu_accepted || false, is_active, passwordHash,
                    JSON.stringify({
                        diploma: (documents_file_ids && documents_file_ids.diploma) || document_file_id || null,
                        ordre: (documents_file_ids && documents_file_ids.ordre) || null
                    }),
                    etablissement_nom || null, etablissement_adresse || null, etablissement_lat || null, etablissement_lng || null, etablissement_ville || null
                ]
            );

            await client.query(
                `INSERT INTO doctors (
                    phone, user_id, full_name, specialty, registration_number,
                    city, neighborhood, bio, status, is_active, member_code,
                    trust_score, momo_number,
                    country_of_residence, order_country, consultation_languages, is_international
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,FALSE,$10,$11,$12,$13,$14,$15,$16)
                 ON CONFLICT (phone) DO NOTHING`,
                [normalizedPhone, newUser.rows[0].id, full_name, specialty, registration_number,
                 city, null, null, autoStatus, member_code,
                 score, normalizedPhone,
                 country_of_residence || null, order_country || null,
                 consultation_languages || null, is_international || false]
            );

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        const user = newUser.rows[0];
        
        try {
            await sendWhatsAppTemplate(normalizedPhone, 'bolamu_bienvenue_medecin_v4', [user.full_name || '']);
        } catch (whatsappError) {
            console.warn('[WhatsApp] Envoi bienvenue échoué (non bloquant)', { phone: normalizedPhone, error: whatsappError.message });
        }
        await sendOnboardingLink(normalizedPhone, user.full_name || '', 'doctor');
        // TODO: supprimer sendBolamuSms après validation WhatsApp
        // await sendBolamuSms(normalizedPhone, `Bolamu - Bienvenue ! Votre mot de passe : ${initialPassword}. Votre dossier est en cours de validation, vous recevrez une confirmation sous 24-48h.`);
        
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.doctor', $1, 'users', $2, $3::jsonb)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code, is_active, score })]
        ).catch((err) => logger.error('[registerDoctor] Audit log error:', err.message));

        return res.status(201).json({
            success: true,
            message: "Compte créé — en attente de validation par l'équipe Bolamu",
            token, phone: normalizedPhone, role: user.role, member_code: user.member_code, is_active
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: "Ce numéro est déjà utilisé." });
        }
        console.error('[registerDoctor]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
}

// ============================================================
// 6. REGISTER PHARMACIE
// ============================================================
async function registerPharmacie(req, res) {
    const { phone, name, responsible_name, rccm_number, city, neighborhood, document_file_id, documents_file_ids, trust_score, cgu_accepted,
        etablissement_nom, etablissement_adresse, etablissement_lat, etablissement_lng, etablissement_ville } = req.body;

    if (!phone || !name || !responsible_name) {
        return res.status(400).json({ success: false, message: "Téléphone, nom de la pharmacie et responsable sont obligatoires." });
    }
    
    // Normalisation du numéro
    const normalizedPhone = normalizePhone(phone);

    try {
        const existing = await pool.query(`SELECT id FROM users WHERE phone = $1`, [normalizedPhone]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: "Un compte existe déjà avec ce numéro." });
        }

        const maxResult = await pool.query(`SELECT MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)) FROM users WHERE role = 'pharmacie' AND member_code IS NOT NULL`);
        const nextNum = (maxResult.rows[0].max || 0) + 1;
        const member_code = `PHM-${String(nextNum).padStart(5, '0')}`;
        const score = trust_score || (rccm_number ? 65 : 30);
        const is_active = false;
        const autoStatus = score >= 80 ? 'verified' : 'pending';

        const initialPassword = generatePassword();
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        logger.info('[REGISTER] Compte créé', { phone: normalizedPhone });

        let newUser;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            newUser = await client.query(
                `INSERT INTO users (
                    phone, role, full_name, responsible_name, rccm_number,
                    city, neighborhood,
                    trust_score, member_code, cgu_accepted, cgu_accepted_at,
                    is_active, password_hash, documents_file_ids, created_at,
                    etablissement_nom, etablissement_adresse, etablissement_lat, etablissement_lng, etablissement_ville
                 ) VALUES (
                    $1, 'pharmacie', $2, $3, $4,
                    $5, $6,
                    $7, $8, $9, NOW(),
                    $10, $11, $12, NOW(),
                    $13, $14, $15, $16, $17
                 ) RETURNING id, phone, role, full_name, member_code, is_active, banned`,
                [normalizedPhone, name, responsible_name, rccm_number || null, city || null, neighborhood || null, score, member_code, cgu_accepted || false, is_active, passwordHash, JSON.stringify({
                    rccm: (documents_file_ids && documents_file_ids.rccm) || document_file_id || null,
                    autorisation: (documents_file_ids && documents_file_ids.autorisation) || null
                }), etablissement_nom || null, etablissement_adresse || null, etablissement_lat || null, etablissement_lng || null, etablissement_ville || null]
            );

            await client.query(
                `INSERT INTO pharmacies (
                    phone, user_id, name, responsible_name, rccm_number,
                    city, neighborhood, status, is_active, member_code,
                    trust_score, momo_number
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11)
                 ON CONFLICT (phone) DO NOTHING`,
                [normalizedPhone, newUser.rows[0].id, name, responsible_name || null, rccm_number || null,
                 city || null, neighborhood || null, autoStatus, member_code,
                 score, normalizedPhone]
            );

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        const user = newUser.rows[0];
        
        try {
            await sendWhatsAppTemplate(normalizedPhone, 'bolamu_bienvenue_pharmacie_v3', [user.full_name || '']);
        } catch (whatsappError) {
            console.warn('[WhatsApp] Envoi bienvenue échoué (non bloquant)', { phone: normalizedPhone, error: whatsappError.message });
        }
        await sendOnboardingLink(normalizedPhone, user.full_name || '', 'pharmacie');
        // TODO: supprimer sendBolamuSms après validation WhatsApp
        // await sendBolamuSms(normalizedPhone, `Bolamu - Bienvenue ! Votre mot de passe : ${initialPassword}. Votre dossier est en cours de validation, vous recevrez une confirmation sous 24-48h.`);
        
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.pharmacie', $1, 'users', $2, $3::jsonb)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code, is_active, score })]
        ).catch((err) => logger.error('[registerPharmacie] Audit log error:', err.message));

        return res.status(201).json({
            success: true,
            message: "Compte créé — en attente de validation par l'équipe Bolamu",
            token, phone: normalizedPhone, role: user.role, member_code: user.member_code, is_active
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: "Ce numéro est déjà utilisé." });
        }
        console.error('[registerPharmacie]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
}

// ============================================================
// 7. REGISTER LABORATOIRE
// ============================================================
async function registerLaboratoire(req, res) {
    const { phone, name, director_name, agrement_number, rccm_number, city, document_file_id, documents_file_ids, trust_score, cgu_accepted,
        etablissement_nom, etablissement_adresse, etablissement_lat, etablissement_lng, etablissement_ville } = req.body;

    if (!phone || !name || !director_name) {
        return res.status(400).json({ success: false, message: "Téléphone, nom du laboratoire et directeur sont obligatoires." });
    }
    
    // Normalisation du numéro
    const normalizedPhone = normalizePhone(phone);

    try {
        const existing = await pool.query(`SELECT id FROM users WHERE phone = $1`, [normalizedPhone]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ success: false, message: "Un compte existe déjà avec ce numéro." });
        }

        const maxResult = await pool.query(`SELECT MAX(CAST(SUBSTRING(member_code FROM 5) AS INTEGER)) FROM users WHERE role = 'laboratoire' AND member_code IS NOT NULL`);
        const nextNum = (maxResult.rows[0].max || 0) + 1;
        const member_code = `LAB-${String(nextNum).padStart(5, '0')}`;
        const score = trust_score || (agrement_number ? 65 : 30);
        const is_active = false;
        const autoStatus = score >= 80 ? 'verified' : 'pending';

        const initialPassword = generatePassword();
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        logger.info('[REGISTER] Compte créé', { phone: normalizedPhone });

        let newUser;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            newUser = await client.query(
                `INSERT INTO users (
                    phone, role, full_name, director_name, agrement_number, rccm_number,
                    city,
                    trust_score, member_code, cgu_accepted, cgu_accepted_at,
                    is_active, password_hash, documents_file_ids, created_at,
                    etablissement_nom, etablissement_adresse, etablissement_lat, etablissement_lng, etablissement_ville
                 ) VALUES (
                    $1, 'laboratoire', $2, $3, $4, $5,
                    $6,
                    $7, $8, $9, NOW(),
                    $10, $11, $12, NOW(),
                    $13, $14, $15, $16, $17
                 ) RETURNING id, phone, role, full_name, member_code, is_active, banned`,
                [normalizedPhone, name, director_name, agrement_number || null, rccm_number || null, city || null, score, member_code, cgu_accepted || false, is_active, passwordHash, JSON.stringify({
                    agrement: (documents_file_ids && documents_file_ids.agrement) || document_file_id || null,
                    rccm: (documents_file_ids && documents_file_ids.rccm) || null
                }), etablissement_nom || null, etablissement_adresse || null, etablissement_lat || null, etablissement_lng || null, etablissement_ville || null]
            );

            await client.query(
                `INSERT INTO laboratories (
                    phone, user_id, name, director_name, agrement_number, rccm_number,
                    city, status, is_active, member_code,
                    trust_score, momo_number
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11)
                 ON CONFLICT (phone) DO NOTHING`,
                [normalizedPhone, newUser.rows[0].id, name, director_name || null, agrement_number || null, rccm_number || null,
                 city || null, autoStatus, member_code,
                 score, normalizedPhone]
            );

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        const user = newUser.rows[0];
        
        try {
            await sendWhatsAppTemplate(normalizedPhone, 'bolamu_bienvenue_labo_v4', [user.full_name || '']);
        } catch (whatsappError) {
            console.warn('[WhatsApp] Envoi bienvenue échoué (non bloquant)', { phone: normalizedPhone, error: whatsappError.message });
        }
        await sendOnboardingLink(normalizedPhone, user.full_name || '', 'laboratoire');
        // TODO: supprimer sendBolamuSms après validation WhatsApp
        // await sendBolamuSms(normalizedPhone, `Bolamu - Bienvenue ! Votre mot de passe : ${initialPassword}. Votre dossier est en cours de validation, vous recevrez une confirmation sous 24-48h.`);
        
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.laboratoire', $1, 'users', $2, $3::jsonb)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code, is_active, score })]
        ).catch((err) => logger.error('[registerLaboratoire] Audit log error:', err.message));

        return res.status(201).json({
            success: true,
            message: "Compte créé — en attente de validation par l'équipe Bolamu",
            token, phone: normalizedPhone, role: user.role, member_code: user.member_code, is_active
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ success: false, message: "Ce numéro est déjà utilisé." });
        }
        console.error('[registerLaboratoire]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
}

// ============================================================
// 8. REFRESH TOKEN
// ============================================================
async function refreshToken(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token requis.' });
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const tokensResult = await pool.query(
            `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND is_revoked = FALSE AND expires_at > NOW()`,
            [tokenHash]
        );

        const validToken = tokensResult.rows[0] || null;

        if (!validToken) {
            return res.status(401).json({ success: false, message: 'Refresh token invalide ou expiré.' });
        }

        // Récupérer l'utilisateur
        const userResult = await pool.query(
            `SELECT id, phone, role, is_active, banned FROM users WHERE phone = $1`,
            [validToken.phone]
        );

        if (!userResult.rows.length) {
            return res.status(404).json({ success: false, message: 'Utilisateur introuvable.' });
        }

        const user = userResult.rows[0];

        if (user.banned) {
            return res.status(403).json({ success: false, message: 'Compte banni.' });
        }

        if (!user.is_active) {
            return res.status(403).json({ success: false, message: 'Compte inactif.' });
        }

        // Générer nouveau access token
        const newAccessToken = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false },
            JWT_SECRET,
            { expiresIn: ACCESS_TOKEN_EXPIRES }
        );

        return res.status(200).json({
            success: true,
            accessToken: newAccessToken
        });
    } catch (err) {
        console.error('[refreshToken]', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ============================================================
// 9. LOGOUT
// ============================================================
async function logout(req, res) {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ success: false, message: 'Refresh token requis.' });
    }

    try {
        const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const result = await pool.query(
            `UPDATE refresh_tokens SET is_revoked = TRUE
             WHERE token_hash = $1 AND is_revoked = FALSE
             RETURNING id`,
            [tokenHash]
        );

        if (!result.rows.length) {
            return res.status(401).json({ success: false, message: 'Refresh token invalide.' });
        }

        return res.status(200).json({ success: true, message: 'Déconnexion réussie.' });
    } catch (err) {
        console.error('[logout]', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

module.exports = { requestOtp, verifyOtp, login, forgotPassword, registerPatient, registerDoctor, registerPharmacie, registerLaboratoire, refreshToken, logout };



