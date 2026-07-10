// ============================================================
// BOLAMU — Service Bons Zora Partenaires (code BOL-XXXX-XXXX)
// Système code-based, parallèle au marketplace Zora (zora_vouchers).
// Débit direct des points (comme zora-marketplace.service.js).
// Terminologie : 'voucher' remplacé par 'bon Zora' (décision produit, sprint dette technique)
// ============================================================
const crypto = require('crypto');
const pool = require('../config/db');
const { normalizePhone } = require('../utils/phone');
const { generateBonZoraCard } = require('./image-generator.service');
const { sendImageMessage } = require('./whatsapp.service');

const BON_ZORA_VALIDITY_DAYS = 30;
const CODE_ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789'; // sans O/0/1/I pour lisibilité

/**
 * Génère un segment alphanumérique majuscule de longueur donnée.
 */
function randomSegment(length) {
  let segment = '';
  for (let i = 0; i < length; i++) {
    const idx = crypto.randomInt(0, CODE_ALPHABET.length);
    segment += CODE_ALPHABET[idx];
  }
  return segment;
}

/**
 * Génère un code bon Zora unique au format BOL-XXXX-XXXX.
 * Vérifie l'unicité contre partner_bons_zora (retry jusqu'à 5 fois).
 */
async function generateUniqueCode(client) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `BOL-${randomSegment(4)}-${randomSegment(4)}`;
    const existing = await client.query(
      'SELECT 1 FROM partner_bons_zora WHERE code = $1',
      [code]
    );
    if (existing.rows.length === 0) return code;
  }
  throw new Error('bon_zora_code_collision');
}

/**
 * Construit les initiales d'un patient à partir de son nom (BHP : jamais le nom complet).
 */
function buildInitials({ first_name, last_name, full_name }) {
  const parts = [];
  if (first_name) parts.push(first_name);
  if (last_name) parts.push(last_name);
  if (parts.length === 0 && full_name) {
    parts.push(...String(full_name).trim().split(/\s+/));
  }
  const initials = parts
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p.charAt(0).toUpperCase())
    .join('.');
  return initials ? `${initials}.` : '—';
}

/**
 * generateBonZora — Le patient échange des points Zora contre un bon Zora partenaire.
 * @param {string} patient_phone
 * @param {number} program_id
 * @returns {Promise<{ code, qr_payload, expires_at }>}
 */
async function generateBonZora(patient_phone, program_id) {
  const phone = normalizePhone(patient_phone);
  if (!phone) return { success: false, error: 'invalid_phone' };
  if (!program_id) return { success: false, error: 'missing_program_id' };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Charger le programme actif (verrou pour le stock)
    const programResult = await client.query(
      `SELECT id, name, description, zora_cost, fcfa_value, category, is_active, stock
       FROM partner_programs
       WHERE id = $1 AND is_active = TRUE
       FOR UPDATE`,
      [program_id]
    );

    if (programResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'program_not_found' };
    }

    const program = programResult.rows[0];

    // Stock : NULL = illimité
    if (program.stock !== null && program.stock <= 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'program_out_of_stock' };
    }

    // 2. Vérifier le solde Zora (colonne balance dans zora_points)
    const pointsResult = await client.query(
      'SELECT balance FROM zora_points WHERE phone = $1 FOR UPDATE',
      [phone]
    );

    if (pointsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'no_zora_account' };
    }

    const balance = parseInt(pointsResult.rows[0].balance, 10) || 0;
    if (balance < program.zora_cost) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_balance' };
    }

    // 3. Débit direct des points (modèle marketplace)
    const debit = await client.query(
      `UPDATE zora_points
       SET balance = balance - $1, updated_at = NOW()
       WHERE phone = $2 AND balance >= $1`,
      [program.zora_cost, phone]
    );

    if (debit.rowCount === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'insufficient_balance' };
    }

    // 4. Générer le code unique BOL-XXXX-XXXX
    const code = await generateUniqueCode(client);

    // 5. Ligne ledger négative (dépense)
    await client.query(
      `INSERT INTO zora_ledger
       (phone, points, category, action_type, proof_class, proof_reference, verified, earned_at, expires_at)
       VALUES ($1, $2, 'redemption', 'bon_zora_generation', 'system_event', $3, TRUE, NOW(), NOW() + INTERVAL '12 months')`,
      [phone, -program.zora_cost, code]
    );

    // 6. Récupérer les initiales du patient (BHP : jamais le nom complet)
    const userResult = await client.query(
      'SELECT first_name, last_name, full_name FROM users WHERE phone = $1',
      [phone]
    );
    const patientInitiales = userResult.rows.length > 0
      ? buildInitials(userResult.rows[0])
      : '—';

    // 7. Construire le QR payload (initiales uniquement, pas de nom complet)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + BON_ZORA_VALIDITY_DAYS);

    const qrPayload = {
      code,
      partner_name: program.name,
      fcfa_value: program.fcfa_value,
      expires_at: expiresAt.toISOString(),
      patient_initiales: patientInitiales
    };

    // 8. INSERT du bon Zora (partner_id/zora_cost/generated_at = vrais noms de colonnes, cf. commit b36f1db)
    const bonResult = await client.query(
      `INSERT INTO partner_bons_zora
       (code, patient_phone, partner_id, zora_cost, qr_payload, fcfa_value, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
       RETURNING id, code, expires_at`,
      [code, phone, program.id, program.zora_cost, JSON.stringify(qrPayload), program.fcfa_value, expiresAt]
    );

    const bon = bonResult.rows[0];

    // 9. Décrémenter le stock si limité
    if (program.stock !== null) {
      await client.query(
        'UPDATE partner_programs SET stock = stock - 1 WHERE id = $1',
        [program.id]
      );
    }

    // 10. Audit (payload jsonb)
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('bon_zora_generated', $1, 'partner_bons_zora', $2, $3::jsonb)`,
      [phone, String(bon.id), JSON.stringify({
        code,
        program_id: program.id,
        zora_cost: program.zora_cost,
        fcfa_value: program.fcfa_value
      })]
    );

    await client.query('COMMIT');

    // Envoi carte cadeau WhatsApp — non bloquant : le bon est déjà généré et
    // débité (transaction commitée ci-dessus), un échec ici ne doit jamais
    // faire échouer la réponse HTTP au frontend.
    try {
      const cardBuffer = await generateBonZoraCard({
        partnerName: program.name,
        offerDescription: program.description,
        code,
        zoraCost: program.zora_cost
      });
      const caption = `-${program.zora_cost} Zora · Nouveau solde : ${balance - program.zora_cost} Zora`;
      await sendImageMessage(phone, cardBuffer, caption);
    } catch (imgErr) {
      console.error('[BON ZORA] Erreur envoi carte cadeau WhatsApp (non bloquant):', imgErr.message);
    }

    return {
      success: true,
      code: bon.code,
      qr_payload: qrPayload,
      expires_at: bon.expires_at
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[BON ZORA] Erreur generateBonZora:', error.message);
    if (error.message === 'bon_zora_code_collision') {
      return { success: false, error: 'bon_zora_code_collision' };
    }
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * validateBonZora — Un partenaire valide un bon Zora (scan QR ou saisie code).
 * Idempotent : un bon Zora ne peut être validé qu'une seule fois (SELECT ... FOR UPDATE).
 * @param {string} code
 * @param {string} partner_phone
 * @param {string} method - 'qr_scan' | 'code_manual'
 * @returns {Promise<{ valid, patient_initiales, fcfa_value }>}
 */
async function validateBonZora(code, partner_phone, method = 'code_manual') {
  const partnerPhone = normalizePhone(partner_phone);
  if (!code) return { success: false, error: 'missing_code' };
  if (!partnerPhone) return { success: false, error: 'invalid_phone' };

  const validMethod = ['qr_scan', 'code_manual'].includes(method) ? method : 'code_manual';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Charger le bon Zora avec verrou (idempotence)
    const bonResult = await client.query(
      `SELECT id, code, patient_phone, fcfa_value, status, expires_at, qr_payload
       FROM partner_bons_zora
       WHERE code = $1
       FOR UPDATE`,
      [String(code).trim().toUpperCase()]
    );

    if (bonResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'bon_zora_not_found' };
    }

    const bon = bonResult.rows[0];

    // 2. Idempotence : déjà utilisé
    if (bon.status === 'used') {
      await client.query('ROLLBACK');
      return { success: false, error: 'bon_zora_already_used' };
    }

    if (bon.status === 'cancelled') {
      await client.query('ROLLBACK');
      return { success: false, error: 'bon_zora_cancelled' };
    }

    // 3. Expiration
    if (bon.status === 'expired' || (bon.expires_at && new Date(bon.expires_at) < new Date())) {
      if (bon.status !== 'expired') {
        await client.query(
          "UPDATE partner_bons_zora SET status = 'expired' WHERE id = $1",
          [bon.id]
        );
      }
      await client.query('COMMIT');
      return { success: false, error: 'bon_zora_expired' };
    }

    if (bon.status !== 'active') {
      await client.query('ROLLBACK');
      return { success: false, error: 'bon_zora_not_active' };
    }

    // 4. Marquer utilisé
    await client.query(
      `UPDATE partner_bons_zora
       SET status = 'used', used_at = NOW(), used_by = $1
       WHERE id = $2`,
      [partnerPhone, bon.id]
    );

    // 5. Journaliser la validation
    await client.query(
      `INSERT INTO partner_validations (voucher_id, partner_phone, validated_at, method)
       VALUES ($1, $2, NOW(), $3)`,
      [bon.id, partnerPhone, validMethod]
    );

    // 6. Initiales + nom partenaire depuis le qr_payload (jamais le nom complet du patient)
    let patientInitiales = '—';
    let partnerName = 'Partenaire';
    try {
      const payload = typeof bon.qr_payload === 'string'
        ? JSON.parse(bon.qr_payload)
        : bon.qr_payload;
      if (payload && payload.patient_initiales) {
        patientInitiales = payload.patient_initiales;
      }
      if (payload && payload.partner_name) {
        partnerName = payload.partner_name;
      }
    } catch (_) {
      // payload illisible — on garde les placeholders
    }

    // 7. Audit
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('bon_zora_validated', $1, 'partner_bons_zora', $2, $3::jsonb)`,
      [partnerPhone, String(bon.id), JSON.stringify({
        code: bon.code,
        method: validMethod,
        fcfa_value: bon.fcfa_value
      })]
    );

    await client.query('COMMIT');

    return {
      success: true,
      valid: true,
      patient_initiales: patientInitiales,
      fcfa_value: bon.fcfa_value,
      partner_name: partnerName,
      used_at: new Date().toISOString()
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[BON ZORA] Erreur validateBonZora:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * getPatientBonsZora — Liste bons Zora actifs + historique utilisés du patient.
 * partner_name extrait du qr_payload (le bon Zora ne stocke pas program_id).
 * @param {string} patient_phone
 */
async function getPatientBonsZora(patient_phone) {
  const phone = normalizePhone(patient_phone);
  if (!phone) return { success: false, error: 'invalid_phone' };

  try {
    const result = await pool.query(
      `SELECT id, code, partner_id, qr_payload, fcfa_value, status,
              generated_at, expires_at, used_at
       FROM partner_bons_zora
       WHERE patient_phone = $1
       ORDER BY generated_at DESC`,
      [phone]
    );

    const bons = result.rows.map(row => {
      let partnerName = null;
      try {
        const payload = typeof row.qr_payload === 'string'
          ? JSON.parse(row.qr_payload)
          : row.qr_payload;
        partnerName = payload && payload.partner_name ? payload.partner_name : null;
      } catch (_) {
        partnerName = null;
      }
      return {
        id: row.id,
        code: row.code,
        program_id: row.partner_id,
        partner_name: partnerName,
        fcfa_value: row.fcfa_value,
        status: row.status,
        created_at: row.generated_at,
        expires_at: row.expires_at,
        validated_at: row.used_at
      };
    });

    return {
      success: true,
      active: bons.filter(v => v.status === 'active'),
      history: bons.filter(v => v.status !== 'active'),
      data: bons
    };
  } catch (error) {
    console.error('[BON ZORA] Erreur getPatientBonsZora:', error.message);
    return { success: false, error: 'server_error' };
  }
}

/**
 * getProgramsByCategory — Liste les programmes partenaires actifs avec stock disponible.
 * @param {string|null} category - filtre optionnel
 */
async function getProgramsByCategory(category) {
  try {
    let query = `
      SELECT id, name, description, zora_cost, fcfa_value, category, stock, created_at
      FROM partner_programs
      WHERE is_active = TRUE
        AND (stock IS NULL OR stock > 0)
    `;
    const params = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ' ORDER BY zora_cost ASC';

    const result = await pool.query(query, params);
    return { success: true, data: result.rows };
  } catch (error) {
    console.error('[BON ZORA] Erreur getProgramsByCategory:', error.message);
    return { success: false, error: 'server_error' };
  }
}

/**
 * getProgramById — Détail d'un programme partenaire (actif ou non).
 * @param {number|string} id
 */
async function getProgramById(id) {
  try {
    const result = await pool.query(
      `SELECT id, name, description, zora_cost, fcfa_value, category, is_active, stock, created_at, partner_phone, image_url
       FROM partner_programs
       WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return { success: false, error: 'program_not_found' };
    }
    const row = result.rows[0];
    return {
      success: true,
      data: {
        id: row.id,
        name: row.name,
        description: row.description,
        zora_cost: row.zora_cost,
        fcfa_value: row.fcfa_value,
        category: row.category,
        is_active: row.is_active,
        stock: row.stock,
        image: row.image_url,
        partner_phone: row.partner_phone,
        created_at: row.created_at
      }
    };
  } catch (error) {
    console.error('[BON ZORA] Erreur getProgramById:', error.message);
    return { success: false, error: 'server_error' };
  }
}

/**
 * getMyPrograms — Toutes les offres (actives ET désactivées) du partenaire connecté.
 * @param {string} partnerPhone
 */
async function getMyPrograms(partnerPhone) {
  try {
    const result = await pool.query(
      `SELECT id, partner_phone, name, description, zora_cost, fcfa_value, category, stock, image_url, is_active, created_at
       FROM partner_programs
       WHERE partner_phone = $1
       ORDER BY created_at DESC`,
      [partnerPhone]
    );
    return { success: true, data: result.rows };
  } catch (error) {
    console.error('[BON ZORA] Erreur getMyPrograms:', error.message);
    return { success: false, error: 'server_error' };
  }
}

/**
 * createProgram — Un partenaire (ou l'admin pour un partenaire précis) crée une offre.
 * @param {Object} data - { partner_phone, name, description, zora_cost, fcfa_value, category, stock, image_url }
 */
async function createProgram(data) {
  const { partner_phone, name, description, zora_cost, fcfa_value, category, stock, image_url } = data;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO partner_programs
       (partner_phone, name, description, zora_cost, fcfa_value, category, stock, image_url, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, NOW())
       RETURNING id, partner_phone, name, description, zora_cost, fcfa_value, category, stock, image_url, is_active, created_at`,
      [partner_phone, name, description || null, zora_cost, fcfa_value || null, category || null, stock ?? null, image_url || null]
    );

    const program = result.rows[0];

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('partner_program_created', $1, 'partner_programs', $2, $3::jsonb)`,
      [partner_phone, String(program.id), JSON.stringify({ name, zora_cost, fcfa_value, category })]
    );

    await client.query('COMMIT');
    return { success: true, data: program };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[BON ZORA] Erreur createProgram:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * updateProgram — Modifie une offre existante (propriétaire ou admin uniquement).
 * @param {number|string} id
 * @param {string} requesterPhone
 * @param {string} requesterRole
 * @param {Object} updates - champs à modifier (partner_phone jamais accepté)
 */
async function updateProgram(id, requesterPhone, requesterRole, updates) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, partner_phone FROM partner_programs WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'program_not_found' };
    }

    const program = existing.rows[0];

    if (requesterRole !== 'admin' && program.partner_phone !== requesterPhone) {
      await client.query('ROLLBACK');
      return { success: false, error: 'not_owner' };
    }

    const allowedFields = ['name', 'description', 'zora_cost', 'fcfa_value', 'category', 'stock', 'image_url', 'is_active'];
    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${idx}`);
        values.push(updates[field]);
        idx++;
      }
    }

    if (setClauses.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'no_fields_to_update' };
    }

    values.push(id);
    const result = await client.query(
      `UPDATE partner_programs SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, partner_phone, name, description, zora_cost, fcfa_value, category, stock, image_url, is_active`,
      values
    );

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('partner_program_updated', $1, 'partner_programs', $2, $3::jsonb)`,
      [requesterPhone, String(id), JSON.stringify(updates)]
    );

    await client.query('COMMIT');
    return { success: true, data: result.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[BON ZORA] Erreur updateProgram:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

/**
 * deactivateProgram — Désactive une offre (is_active = false, jamais de suppression physique).
 * Propriétaire ou admin uniquement.
 * @param {number|string} id
 * @param {string} requesterPhone
 * @param {string} requesterRole
 */
async function deactivateProgram(id, requesterPhone, requesterRole) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      `SELECT id, partner_phone FROM partner_programs WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'program_not_found' };
    }

    const program = existing.rows[0];

    if (requesterRole !== 'admin' && program.partner_phone !== requesterPhone) {
      await client.query('ROLLBACK');
      return { success: false, error: 'not_owner' };
    }

    await client.query(`UPDATE partner_programs SET is_active = FALSE WHERE id = $1`, [id]);

    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('partner_program_deactivated', $1, 'partner_programs', $2, $3::jsonb)`,
      [requesterPhone, String(id), '{}']
    );

    await client.query('COMMIT');
    return { success: true };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[BON ZORA] Erreur deactivateProgram:', error.message);
    return { success: false, error: 'server_error' };
  } finally {
    client.release();
  }
}

module.exports = {
  generateBonZora,
  validateBonZora,
  getPatientBonsZora,
  getProgramsByCategory,
  getProgramById,
  getMyPrograms,
  createProgram,
  updateProgram,
  deactivateProgram
};
