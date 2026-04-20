const pool = require('../config/db');
const { generateOtp, simulateSendOtp } = require('../utils/otp');
const { hashText } = require('../utils/hash');
const { normalizePhone } = require('../utils/phone');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'bolamu_cle_secrete_brazzaville_2026';
const JWT_EXPIRES = '7d';

// ============================================================
// 1. DEMANDER OTP
// ============================================================
async function requestOtp(req, res) {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Numéro requis" });
    
    // Normalisation du numéro
    let normalizedPhone = (phone || '').trim().replace(/\s+/g,'');
    // Supprime le 0 après l'indicatif +242
    normalizedPhone = normalizedPhone.replace(/^(\+242)0(\d{8})$/, '$1$2');
    // Supprime le 0 après tout autre indicatif africain
    normalizedPhone = normalizedPhone.replace(/^(\+\d{2,3})0(\d{7,8})$/, '$1$2');
    // Format local 0XXXXXXXX → +24269XXXXXXXX
    if (/^0\d{8}$/.test(normalizedPhone)) normalizedPhone = '+242' + normalizedPhone.slice(1);

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
// 3. LOGIN COMPLET (OTP → JWT → DASHBOARD)
//    Si le numéro n'existe pas et que les données patient
//    sont présentes, on crée le compte automatiquement.
// ============================================================
async function login(req, res) {
    const { phone, otp, prenom, nom, sexe, age } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: "Téléphone et OTP requis" });
    
    // Normalisation du numéro
    let normalizedPhone = (phone || '').trim().replace(/\s+/g,'');
    // Supprime le 0 après l'indicatif +242
    normalizedPhone = normalizedPhone.replace(/^(\+242)0(\d{8})$/, '$1$2');
    // Supprime le 0 après tout autre indicatif africain
    normalizedPhone = normalizedPhone.replace(/^(\+\d{2,3})0(\d{7,8})$/, '$1$2');
    // Format local 0XXXXXXXX → +24269XXXXXXXX
    if (/^0\d{8}$/.test(normalizedPhone)) normalizedPhone = '+242' + normalizedPhone.slice(1);

    try {
        // ── Vérification OTP ──
        const otpResult = await pool.query(`SELECT * FROM otp_codes WHERE phone = $1`, [normalizedPhone]);
        if (otpResult.rows.length === 0) return res.status(404).json({ success: false, message: "OTP non trouvé. Veuillez redemander un code." });

        const record = otpResult.rows[0];
        if (new Date() > new Date(record.expires_at)) return res.status(400).json({ success: false, message: "OTP expiré. Veuillez redemander un code." });
        if (record.attempts >= 5) return res.status(403).json({ success: false, message: "Trop de tentatives. Veuillez redemander un code." });

        // Hash de l'OTP reçu pour comparaison
        const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
        if (otpHash !== record.hashed_otp) {
            await pool.query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1`, [normalizedPhone]);
            return res.status(401).json({ success: false, message: "Code OTP incorrect." });
        }

        // OTP valide → on le supprime
        await pool.query(`DELETE FROM otp_codes WHERE phone = $1`, [normalizedPhone]);

        // ── Chercher l'utilisateur ──
        let userResult = await pool.query(`SELECT id, phone, role, full_name FROM users WHERE phone = $1`, [normalizedPhone]);

        // ── Si inexistant et données patient fournies → création automatique ──
        if (userResult.rows.length === 0) {
            if (prenom && nom) {
                // Créer le compte patient à la volée
                const full_name = `${prenom} ${nom}`.trim();
                const countResult = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'patient'`);
                const count = parseInt(countResult.rows[0].count) + 1;
                const member_code = `BLM-${String(count).padStart(5, '0')}`;

                const insertResult = await pool.query(
                    `INSERT INTO users (
                        phone, role, full_name, first_name, last_name,
                        gender, age, member_code,
                        cgu_accepted, cgu_accepted_at,
                        is_active, trust_score, created_at
                    ) VALUES (
                        $1, 'patient', $2, $3, $4,
                        $5, $6, $7,
                        true, NOW(),
                        true, 80, NOW()
                    ) RETURNING id, phone, role, full_name, member_code`,
                    [normalizedPhone, full_name, prenom, nom, sexe || null, age || null, member_code]
                );

                userResult = { rows: [insertResult.rows[0]] };

                await pool.query(
                    `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
                     VALUES ('register.patient.auto', $1, 'users', $2, $3)`,
                    [normalizedPhone, insertResult.rows[0].id, JSON.stringify({ member_code, source: 'login_auto' })]
                ).catch(() => {});

            } else {
                // Pas de données patient → vraiment introuvable, inviter à s'inscrire
                return res.status(404).json({
                    success: false,
                    message: "Compte introuvable. Veuillez compléter votre inscription."
                });
            }
        }

        const user = userResult.rows[0];

        // ── Blocage admin ──
        if (user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: "Accès non autorisé. Utilisez le portail administrateur.",
                redirectUrl: "/admin/login.html"
            });
        }

        // ── Génération JWT ──
        const token = jwt.sign(
            { id: user.id, phone: user.phone, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        // ── Redirection selon rôle ──
        let redirectUrl = "/login.html";
        switch (user.role) {
            case 'patient':     redirectUrl = "/patient/dashboard.html"; break;
            case 'doctor':      redirectUrl = "/medecin/dashboard.html"; break;
            case 'medecin':     redirectUrl = "/medecin/dashboard.html"; break;
            case 'pharmacie':   redirectUrl = "/pharmacie/dashboard.html"; break;
            case 'laboratoire': redirectUrl = "/laboratoire/dashboard.html"; break;
        }

        return res.status(200).json({
            success: true,
            message: "Connexion réussie",
            token,
            role: user.role,
            phone: normalizedPhone,
            redirectUrl
        });

    } catch (err) {
        console.error('[login]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur : " + err.message });
    }
}

// ============================================================
// 4. REGISTER PATIENT
// ============================================================
async function registerPatient(req, res) {
    const { phone, first_name, last_name, full_name, gender, age, city, neighborhood, cgu_accepted } = req.body;

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

        const countResult = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'patient'`);
        const count = parseInt(countResult.rows[0].count) + 1;
        const member_code = `BLM-${String(count).padStart(5, '0')}`;
        const finalName = full_name || `${first_name} ${last_name}`.trim();

        const insertResult = await pool.query(
            `INSERT INTO users (
                phone, role, full_name, first_name, last_name,
                gender, age, city, neighborhood,
                member_code, cgu_accepted, cgu_accepted_at,
                is_active, trust_score, created_at
             ) VALUES (
                $1, 'patient', $2, $3, $4,
                $5, $6, $7, $8,
                $9, $10, NOW(),
                true, 80, NOW()
             ) RETURNING id, phone, role, full_name, member_code`,
            [normalizedPhone, finalName, first_name, last_name, gender || null, age || null, city || null, neighborhood || null, member_code, cgu_accepted || false]
        );

        const user = insertResult.rows[0];
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

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

        const countResult = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'doctor'`);
        const count = parseInt(countResult.rows[0].count) + 1;
        const member_code = `MED-${String(count).padStart(5, '0')}`;
        const score = trust_score || (registration_number ? 60 : 30);
        const is_active = score >= 80;

        const insertResult = await pool.query(
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
             ) RETURNING id, phone, role, full_name, member_code`,
            [
                normalizedPhone, full_name, first_name || null, last_name || null,
                specialty, registration_number, order_country || 'Congo-Brazzaville',
                country_of_residence || 'Congo-Brazzaville', consultation_languages || 'Français',
                is_international || false, city || null, document_url || null,
                score, member_code, cgu_accepted || false, is_active
            ]
        );

        const user = insertResult.rows[0];
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.doctor', $1, 'users', $2, $3)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code, is_active, score })]
        ).catch(() => {});

        return res.status(201).json({
            success: true,
            message: is_active ? "Compte médecin activé" : "Compte créé — en attente de validation par l'équipe Bolamu",
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

        const countResult = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'pharmacie'`);
        const count = parseInt(countResult.rows[0].count) + 1;
        const member_code = `PHM-${String(count).padStart(5, '0')}`;
        const score = trust_score || (rccm_number ? 65 : 30);
        const is_active = score >= 80;

        const insertResult = await pool.query(
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
             ) RETURNING id, phone, role, full_name, member_code`,
            [normalizedPhone, name, responsible_name, rccm_number || null, city || null, neighborhood || null, document_url || null, score, member_code, cgu_accepted || false, is_active]
        );

        const user = insertResult.rows[0];
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.pharmacie', $1, 'users', $2, $3)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code, is_active, score })]
        ).catch(() => {});

        return res.status(201).json({
            success: true,
            message: is_active ? "Compte pharmacie activé" : "Compte créé — en attente de validation par l'équipe Bolamu",
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

        const countResult = await pool.query(`SELECT COUNT(*) FROM users WHERE role = 'laboratoire'`);
        const count = parseInt(countResult.rows[0].count) + 1;
        const member_code = `LAB-${String(count).padStart(5, '0')}`;
        const score = trust_score || (agrement_number ? 65 : 30);
        const is_active = score >= 80;

        const insertResult = await pool.query(
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
             ) RETURNING id, phone, role, full_name, member_code`,
            [normalizedPhone, name, director_name, agrement_number || null, rccm_number || null, city || null, document_url || null, score, member_code, cgu_accepted || false, is_active]
        );

        const user = insertResult.rows[0];
        const token = jwt.sign({ id: user.id, phone: user.phone, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

        await pool.query(
            `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload) VALUES ('register.laboratoire', $1, 'users', $2, $3)`,
            [normalizedPhone, user.id, JSON.stringify({ member_code, is_active, score })]
        ).catch(() => {});

        return res.status(201).json({
            success: true,
            message: is_active ? "Compte laboratoire activé" : "Compte créé — en attente de validation par l'équipe Bolamu",
            token, phone: normalizedPhone, role: user.role, member_code: user.member_code, is_active
        });
    } catch (err) {
        console.error('[registerLaboratoire]', err.message);
        return res.status(500).json({ success: false, message: "Erreur serveur : " + err.message });
    }
}

module.exports = { requestOtp, verifyOtp, login, registerPatient, registerDoctor, registerPharmacie, registerLaboratoire };