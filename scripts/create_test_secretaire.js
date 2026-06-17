// ============================================================
// BOLAMU — Script : création compte secrétaire de TEST (local)
// ============================================================
// Crée un compte secrétaire (users role='secretaire' + secretaires)
// dans une transaction avec ROLLBACK, mot de passe hashé bcrypt.
//
// Lancement :  node scripts/create_test_secretaire.js
// ============================================================
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { normalizePhone } = require('../src/utils/phone');

// ─── CONFIG (à ajuster si besoin) ───────────────────────────
// NB : +242060000001 est DÉJÀ le compte médecin de test → on utilise ...002
const SECRETAIRE_PHONE   = '+242060000002';
const SECRETAIRE_PASSWORD = 'Test1234';
const SECRETAIRE_NOM      = 'Test';
const SECRETAIRE_PRENOM   = 'Secrétaire';
const SECRETAIRE_ACTIVE   = true;

// Partenaire de rattachement (DOIT exister dans users) — FK obligatoire
const PARTENAIRE_PHONE = '+242060000001'; // médecin Dr. Mbemba Jean (test)
const PARTENAIRE_TYPE  = 'doctor';        // 'clinic' | 'doctor'
// ────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createTestSecretaire() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL manquant dans .env');
    process.exit(1);
  }

  const phone = normalizePhone(SECRETAIRE_PHONE);
  const partenairePhone = normalizePhone(PARTENAIRE_PHONE);

  const client = await pool.connect();
  try {
    // 1. Vérifier que le partenaire existe (FK NOT NULL)
    const partner = await client.query(
      'SELECT phone, role FROM users WHERE phone = $1',
      [partenairePhone]
    );
    if (partner.rows.length === 0) {
      console.error(`❌ Partenaire introuvable : ${partenairePhone}. Renseignez un PARTENAIRE_PHONE existant.`);
      process.exit(1);
    }

    // 2. Vérifier que le secrétaire n'existe pas déjà (anti double-insertion)
    const existing = await client.query(
      'SELECT phone FROM users WHERE phone = $1',
      [phone]
    );
    if (existing.rows.length > 0) {
      console.error(`❌ Le numéro ${phone} existe déjà dans users. Choisissez un autre SECRETAIRE_PHONE.`);
      process.exit(1);
    }

    // 3. Transaction : INSERT users + secretaires + audit_log
    await client.query('BEGIN');

    const hashedPassword = await bcrypt.hash(SECRETAIRE_PASSWORD, 10);
    const fullName = `${SECRETAIRE_PRENOM} ${SECRETAIRE_NOM}`.trim();

    await client.query(
      `INSERT INTO users (phone, password_hash, role, full_name, is_active, created_at)
       VALUES ($1, $2, 'secretaire', $3, $4, NOW())`,
      [phone, hashedPassword, fullName, SECRETAIRE_ACTIVE]
    );

    await client.query(
      `INSERT INTO secretaires (phone, partenaire_phone, partenaire_type, nom, prenom, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [phone, partenairePhone, PARTENAIRE_TYPE, SECRETAIRE_NOM, SECRETAIRE_PRENOM, SECRETAIRE_ACTIVE]
    );

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('secretaire_cree_test', $1, 'secretaires', NULL, $2)`,
      [partenairePhone, JSON.stringify({ secretaire_phone: phone, nom: SECRETAIRE_NOM, prenom: SECRETAIRE_PRENOM, source: 'script_test' })]
    );

    await client.query('COMMIT');

    console.log('✅ Compte secrétaire de test créé avec succès');
    console.log('   Téléphone    :', phone);
    console.log('   Mot de passe :', SECRETAIRE_PASSWORD);
    console.log('   Partenaire   :', partenairePhone, `(${PARTENAIRE_TYPE})`);
    console.log('   is_active    :', SECRETAIRE_ACTIVE);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur — transaction annulée (ROLLBACK) :', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

createTestSecretaire();
