const pool = require('../config/db');
const { generateOtp, simulateSendOtp } = require('../utils/otp');
const { hashText } = require('../utils/hash');
const { normalizePhone } = require('../utils/phone');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { sendBolamuSms } = require('../services/sms.service');

const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';
const JWT_EXPIRES = '7d';

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
        
        if (!user.password_hash) return res.status(401).json({ success: false, message: 'Mot de passe non défini. Contactez le support.' });
        
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ success: false, message: 'Mot de passe incorrect.' });
        
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );
        
        let redirectUrl = '/login.html';
        switch (user.role) {
            case 'patient':     redirectUrl = '/patient/dashboard.html'; break;
            case 'doctor':      redirectUrl = '/medecin/dashboard.html'; break;
            case 'pharmacie':   redirectUrl = '/pharmacie/dashboard.html'; break;
            case 'laboratoire': redirectUrl = '/laboratoire/dashboard.html'; break;
        }
        
        return res.status(200).json({
            success: true,
            message: 'Connexion réussie',
            token,
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
        
        await sendBolamuSms(normalizedPhone, `Bolamu - Votre nouveau mot de passe temporaire : ${newPassword}. Connectez-vous et changez-le dans votre profil.`);
        
        return res.status(200).json({ success: true, message: 'Nouveau mot de passe envoyé par SMS.' });
    } catch (err) {
        console.error('[forgotPassword]', err.message);
        return res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
}

// ============================================================
// 5. REGISTER PATIENT
// ============================================================
async function registerPatient(req, res) {
    const { phone, first_name, last_name, full_name, gender, age, city, neighborhood, niu, id_card_url, id_card_public_id, cgu_accepted } = req.body;

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

        const insertResult = await pool.query(
            `INSERT INTO users (
                phone, role, full_name, first_name, last_name,
                gender, age, city, neighborhood, niu, id_card_url, id_card_public_id,
                member_code, cgu_accepted, cgu_accepted_at,
                is_active, trust_score, created_at
             ) VALUES (
                $1, 'patient', $2, $3, $4,
                $5, $6, $7, $8, $9, $10, $11,
                $12, $13, NOW(),
                true, 80, NOW()
             ) RETURNING id, phone, role, full_name, member_code, is_active, banned`,
            [normalizedPhone, finalName, first_name, last_name, gender || null, age || null, city || null, neighborhood || null, niu || null, id_card_url || null, id_card_public_id || null, member_code, cgu_accepted || false]
        );

        const user = insertResult.rows[0];
        
        const initialPassword = generatePassword();
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        await pool.query(`UPDATE users SET password_hash = $1 WHERE phone = $2`, [passwordHash, normalizedPhone]);
        await sendBolamuSms(normalizedPhone, `Bolamu - Bienvenue ! Votre mot de passe : ${initialPassword}. Gardez-le précieusement.`);
        
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.patient', $1, 'users', $2, $3)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code })]
        ).catch(() => {});

        return res.status(201).json({ success: true, message: "Compte patient créé avec succès", token, phone: normalizedPhone, role: user.role, member_code: user.member_code });
    } catch (err) {
        console.error('[registerPatient]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur : " + err.message });
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
        is_international, city, document_url, trust_score, cgu_accepted
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

        let newUser;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            newUser = await client.query(
                `INSERT INTO users (
                    phone, role, full_name, first_name, last_name,
                    specialty, registration_number, order_country,
                    country_of_residence, consultation_languages,
                    is_international, city, document_url,
                    trust_score, member_code, cgu_accepted, cgu_accepted_at,
                    is_active, created_at
                 ) VALUES (
                    $1, 'doctor', $2, $3, $4,
                    $5, $6, $7,
                    $8, $9,
                    $10, $11, $12,
                    $13, $14, $15, NOW(),
                    $16, NOW()
                 ) RETURNING id, phone, role, full_name, member_code, is_active, banned`,
                [
                    normalizedPhone, full_name, first_name || null, last_name || null,
                    specialty, registration_number, order_country || 'Congo-Brazzaville',
                    country_of_residence || 'Congo-Brazzaville', consultation_languages || 'Français',
                    is_international || false, city || null, document_url || null,
                    score, member_code, cgu_accepted || false, is_active
                ]
            );

            await client.query(
                `INSERT INTO doctors (
                    phone, user_id, full_name, specialty, registration_number,
                    city, neighborhood, bio, status, is_active, member_code,
                    document_url, document_public_id, trust_score, momo_number,
                    country_of_residence, order_country, consultation_languages, is_international
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
                 ON CONFLICT (phone) DO NOTHING`,
                [normalizedPhone, newUser.rows[0].id, full_name, specialty, registration_number,
                 city, null, null, autoStatus, member_code,
                 document_url || null, null, score, normalizedPhone,
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
        
        const initialPassword = generatePassword();
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        await pool.query(`UPDATE users SET password_hash = $1 WHERE phone = $2`, [passwordHash, normalizedPhone]);
        await sendBolamuSms(normalizedPhone, `Bolamu - Bienvenue ! Votre mot de passe : ${initialPassword}. Gardez-le précieusement.`);
        
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.doctor', $1, 'users', $2, $3)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code, is_active, score })]
        ).catch(() => {});

        return res.status(201).json({
            success: true,
            message: "Compte créé — en attente de validation par l'équipe Bolamu",
            token, phone: normalizedPhone, role: user.role, member_code: user.member_code, is_active
        });
    } catch (err) {
        console.error('[registerDoctor]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur : " + err.message });
    }
}

// ============================================================
// 6. REGISTER PHARMACIE
// ============================================================
async function registerPharmacie(req, res) {
    const { phone, name, responsible_name, rccm_number, city, neighborhood, document_url, trust_score, cgu_accepted } = req.body;

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

        let newUser;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            newUser = await client.query(
                `INSERT INTO users (
                    phone, role, full_name, responsible_name, rccm_number,
                    city, neighborhood, document_url,
                    trust_score, member_code, cgu_accepted, cgu_accepted_at,
                    is_active, created_at
                 ) VALUES (
                    $1, 'pharmacie', $2, $3, $4,
                    $5, $6, $7,
                    $8, $9, $10, NOW(),
                    $11, NOW()
                 ) RETURNING id, phone, role, full_name, member_code, is_active, banned`,
                [normalizedPhone, name, responsible_name, rccm_number || null, city || null, neighborhood || null, document_url || null, score, member_code, cgu_accepted || false, is_active]
            );

            await client.query(
                `INSERT INTO pharmacies (
                    phone, user_id, name, responsible_name, rccm_number,
                    city, neighborhood, status, is_active, member_code,
                    document_url, trust_score, momo_number
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11,$12)
                 ON CONFLICT (phone) DO NOTHING`,
                [normalizedPhone, newUser.rows[0].id, name, responsible_name || null, rccm_number || null,
                 city || null, neighborhood || null, autoStatus, member_code,
                 document_url || null, score, normalizedPhone]
            );

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        const user = newUser.rows[0];
        
        const initialPassword = generatePassword();
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        await pool.query(`UPDATE users SET password_hash = $1 WHERE phone = $2`, [passwordHash, normalizedPhone]);
        await sendBolamuSms(normalizedPhone, `Bolamu - Bienvenue ! Votre mot de passe : ${initialPassword}. Gardez-le précieusement.`);
        
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.pharmacie', $1, 'users', $2, $3)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code, is_active, score })]
        ).catch(() => {});

        return res.status(201).json({
            success: true,
            message: "Compte créé — en attente de validation par l'équipe Bolamu",
            token, phone: normalizedPhone, role: user.role, member_code: user.member_code, is_active
        });
    } catch (err) {
        console.error('[registerPharmacie]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur : " + err.message });
    }
}

// ============================================================
// 7. REGISTER LABORATOIRE
// ============================================================
async function registerLaboratoire(req, res) {
    const { phone, name, director_name, agrement_number, rccm_number, city, document_url, trust_score, cgu_accepted } = req.body;

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

        let newUser;
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            newUser = await client.query(
                `INSERT INTO users (
                    phone, role, full_name, director_name, agrement_number, rccm_number,
                    city, document_url,
                    trust_score, member_code, cgu_accepted, cgu_accepted_at,
                    is_active, created_at
                 ) VALUES (
                    $1, 'laboratoire', $2, $3, $4, $5,
                    $6, $7,
                    $8, $9, $10, NOW(),
                    $11, NOW()
                 ) RETURNING id, phone, role, full_name, member_code, is_active, banned`,
                [normalizedPhone, name, director_name, agrement_number || null, rccm_number || null, city || null, document_url || null, score, member_code, cgu_accepted || false, is_active]
            );

            await client.query(
                `INSERT INTO laboratories (
                    phone, user_id, name, director_name, agrement_number, rccm_number,
                    city, status, is_active, member_code,
                    document_url, trust_score, momo_number
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,FALSE,$9,$10,$11,$12)
                 ON CONFLICT (phone) DO NOTHING`,
                [normalizedPhone, newUser.rows[0].id, name, director_name || null, agrement_number || null, rccm_number || null,
                 city || null, autoStatus, member_code,
                 document_url || null, score, normalizedPhone]
            );

            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        const user = newUser.rows[0];
        
        const initialPassword = generatePassword();
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        await pool.query(`UPDATE users SET password_hash = $1 WHERE phone = $2`, [passwordHash, normalizedPhone]);
        await sendBolamuSms(normalizedPhone, `Bolamu - Bienvenue ! Votre mot de passe : ${initialPassword}. Gardez-le précieusement.`);
        
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role, is_active: user.is_active, banned: user.banned || false }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.laboratoire', $1, 'users', $2, $3)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code, is_active, score })]
        ).catch(() => {});

        return res.status(201).json({
            success: true,
            message: "Compte créé — en attente de validation par l'équipe Bolamu",
            token, phone: normalizedPhone, role: user.role, member_code: user.member_code, is_active
        });
    } catch (err) {
        console.error('[registerLaboratoire]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur : " + err.message });
    }
}

module.exports = { requestOtp, verifyOtp, login, forgotPassword, registerPatient, registerDoctor, registerPharmacie, registerLaboratoire };



