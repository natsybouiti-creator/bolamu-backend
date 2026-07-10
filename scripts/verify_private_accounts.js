const pool = require('../src/config/db');
const { awardZora } = require('../src/services/zora.service');

// ⚠️ PHONE_A a un zora_ledger décorrélé de zora_points.balance suite à des set-zora-balance
// répétés (voir NOTES_TEST_ACCOUNTS.md) — ne pas l'utiliser pour un test d'intégrité balance=SUM(ledger).
const PHONE_A = '+242099999999'; // Test Zora, ID 62 (compte privé)
const PHONE_B = '+242069735419'; // Sarah Test, ID 225 (visiteur)

async function checkPhone(client, phone) {
  const r = await client.query('SELECT id, phone, full_name, is_private FROM users WHERE phone = $1', [phone]);
  return r.rows[0];
}

async function main() {
  const client = await pool.connect();
  try {
    const arg = process.argv[2];

    if (arg === 'audit-last') {
      const r = await client.query(
        `SELECT id, event_type, actor_phone, target_table, target_id, payload, created_at
         FROM audit_log WHERE event_type LIKE 'is_private%' OR event_type LIKE 'follow_request%' ORDER BY created_at DESC LIMIT 5`
      );
      console.log(r.rows);
      return;
    }

    if (arg === 'follow-state') {
      const f = await client.query(
        'SELECT * FROM follows WHERE follower_phone = $1 AND following_phone = $2',
        [PHONE_B, PHONE_A]
      );
      const fr = await client.query(
        'SELECT * FROM follow_requests WHERE requester_phone = $1 AND target_phone = $2',
        [PHONE_B, PHONE_A]
      );
      console.log('follows (B follows A):', f.rows);
      console.log('follow_requests (B -> A):', fr.rows);
      return;
    }

    if (arg === 'follow-check') {
      const follower = process.argv[3];
      const following = process.argv[4];
      const f = await client.query(
        'SELECT * FROM follows WHERE follower_phone = $1 AND following_phone = $2',
        [follower, following]
      );
      const fr = await client.query(
        'SELECT * FROM follow_requests WHERE requester_phone = $1 AND target_phone = $2',
        [follower, following]
      );
      console.log(`follows (${follower} -> ${following}):`, f.rows);
      console.log(`follow_requests (${follower} -> ${following}):`, fr.rows);
      return;
    }

    if (arg && arg.startsWith('+')) {
      console.log(await checkPhone(client, arg));
      return;
    }

    if (arg === 'check-notif-row') {
      const r = await client.query(
        `SELECT id, user_phone, type, titre, message, created_at FROM notifications
         WHERE user_phone = $1 AND type = $2 ORDER BY created_at DESC LIMIT 1`,
        [process.argv[3], process.argv[4]]
      );
      console.log(r.rows);
      return;
    }

    if (arg === 'check-club-cover-audit') {
      const r = await client.query(
        `SELECT id, event_type, actor_phone, target_table, target_id, payload, created_at
         FROM audit_log WHERE event_type = 'club_cover_updated' ORDER BY created_at DESC LIMIT 3`
      );
      console.log(r.rows);
      return;
    }

    if (arg === 'schema-clubs') {
      const r = await client.query(
        "SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'clubs' ORDER BY ordinal_position"
      );
      console.log(r.rows);
      return;
    }

    if (arg === 'fk-audit') {
      const tables = ['follows', 'follow_requests', 'audit_log', 'clubs', 'club_members', 'conversations', 'conversation_participants', 'posts', 'post_likes', 'post_comments'];
      for (const t of tables) {
        const r = await client.query(
          `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
           WHERE conrelid = $1::regclass AND contype = 'f'`,
          [t]
        ).catch(e => ({ rows: [{ error: e.message }] }));
        console.log(`\n--- FK sur ${t} ---`);
        console.log(r.rows);
      }
      return;
    }

    if (arg === 'check-notif-constraint') {
      const r = await client.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'notifications'::regclass AND contype = 'c'`
      );
      console.log(r.rows);
      return;
    }

    if (arg === 'toggle-club-active') {
      const clubId = process.argv[3];
      const active = process.argv[4] === 'true';
      const r = await client.query(
        'UPDATE clubs SET is_active = $1 WHERE id = $2 RETURNING id, name, is_active, cover_image_path',
        [active, clubId]
      );
      console.log(r.rows);
      return;
    }

    if (arg === 'find-daffe-3a') {
      const r = await client.query("SELECT id, phone, full_name, role FROM users WHERE full_name ILIKE '%daffe%' OR full_name ILIKE '%daffé%' OR full_name ILIKE '%3a%'");
      console.log(r.rows);
      return;
    }

    if (arg === 'find-known-partners') {
      const pharma = await client.query("SELECT id, phone, full_name FROM users WHERE role='pharmacie' OR role='pharmacy'").catch(e => ({rows:[{error:e.message}]}));
      const labo = await client.query("SELECT id, phone, full_name FROM users WHERE role='laboratoire' OR role='laboratory'").catch(e => ({rows:[{error:e.message}]}));
      const clinic = await client.query("SELECT id, phone, full_name FROM users WHERE full_name ILIKE '%louise michel%' OR full_name ILIKE '%clinique%'").catch(e => ({rows:[{error:e.message}]}));
      console.log('Pharmacies:', pharma.rows);
      console.log('Laboratoires:', labo.rows);
      console.log('Cliniques (nom):', clinic.rows);
      return;
    }

    if (arg === 'schema-partner-programs-full') {
      const cols = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
         FROM information_schema.columns WHERE table_name = 'partner_programs' ORDER BY ordinal_position`
      );
      const checks = await client.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conrelid = 'partner_programs'::regclass AND contype IN ('c','f','u','p')`
      );
      console.log('Colonnes:', cols.rows);
      console.log('\nContraintes (CHECK/FK/UNIQUE/PK):', checks.rows);
      return;
    }

    if (arg === 'set-zora-balance') {
      const phone = process.argv[3];
      const amount = parseInt(process.argv[4], 10);
      const r = await client.query(
        `UPDATE zora_points SET balance = $1, total_earned = GREATEST(total_earned, $1) WHERE phone = $2 RETURNING phone, balance, total_earned`,
        [amount, phone]
      );
      console.log(r.rows);
      return;
    }

    if (arg === 'cleanup-bonzora-test') {
      const phone = process.argv[3];
      const code = process.argv[4];
      try {
        await client.query('BEGIN');
        const before = await client.query('SELECT phone, balance, total_earned FROM zora_points WHERE phone = $1', [phone]);
        const r1 = await client.query(
          'UPDATE zora_points SET balance = 300 WHERE phone = $1 RETURNING phone, balance, total_earned',
          [phone]
        );
        const r2 = await client.query(
          "UPDATE partner_bons_zora SET status = 'cancelled' WHERE code = $1 RETURNING id, code, status",
          [code]
        );
        await client.query('COMMIT');
        console.log('AVANT:', before.rows[0]);
        console.log('APRES zora_points:', r1.rows[0]);
        console.log('APRES partner_bons_zora:', r2.rows[0]);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error('Erreur, ROLLBACK effectué:', e.message);
      }
      return;
    }

    if (arg === 'award-zora-test') {
      const phone = process.argv[3];
      const r1 = await awardZora({ phone, action_type: 'bilan_annuel', proof_class: 'system_event', proof_source: 'test_chantier2', recording_method: null, proof_reference: 'test_chantier2_bilan_' + Date.now() });
      const r2 = await awardZora({ phone, action_type: 'consultation', proof_class: 'system_event', proof_source: 'test_chantier2', recording_method: null, proof_reference: 'test_chantier2_consult_' + Date.now() });
      console.log('Crédit 1 (bilan_annuel):', r1);
      console.log('Crédit 2 (consultation):', r2);
      return;
    }

    if (arg === 'award-zora-test2') {
      const phone = process.argv[3];
      const r1 = await awardZora({ phone, action_type: 'parrainage', proof_class: 'system_event', proof_source: 'test_chantier3', recording_method: null, proof_reference: 'test_chantier3_parrainage_' + Date.now() });
      const r2 = await awardZora({ phone, action_type: 'profil_complete', proof_class: 'system_event', proof_source: 'test_chantier3', recording_method: null, proof_reference: 'test_chantier3_profil_' + Date.now() });
      console.log('Crédit 1 (parrainage):', r1);
      console.log('Crédit 2 (profil_complete):', r2);
      return;
    }

    if (arg === 'check-zora-state') {
      const phone = process.argv[3];
      const points = await client.query('SELECT phone, balance, total_earned, tier FROM zora_points WHERE phone = $1', [phone]);
      const ledgerSum = await client.query('SELECT COALESCE(SUM(points),0) AS sum FROM zora_ledger WHERE phone = $1', [phone]);
      const ledgerRows = await client.query('SELECT id, points, category, action_type, proof_reference, earned_at FROM zora_ledger WHERE phone = $1 ORDER BY earned_at DESC LIMIT 10', [phone]);
      const bon = await client.query("SELECT id, code, patient_phone, partner_id, zora_cost, fcfa_value, status, generated_at, expires_at FROM partner_bons_zora WHERE code = $1", [process.argv[4] || 'BOL-PEMC-7AGS']);
      console.log('zora_points:', points.rows);
      console.log('SUM(zora_ledger.points):', ledgerSum.rows[0].sum);
      console.log('10 dernières lignes ledger:', ledgerRows.rows);
      console.log('bon test:', bon.rows);
      return;
    }

    if (arg === 'select-partner-programs') {
      const r = await client.query('SELECT * FROM partner_programs ORDER BY id');
      console.log(JSON.stringify(r.rows, null, 2));
      return;
    }

    if (arg === 'check-partner-programs') {
      const total = await client.query('SELECT COUNT(*) FROM partner_programs');
      const active = await client.query("SELECT COUNT(*) FROM partner_programs WHERE is_active = TRUE AND (stock IS NULL OR stock > 0)");
      const sample = await client.query('SELECT id, name, is_active, stock, zora_cost FROM partner_programs LIMIT 5');
      console.log('Total lignes:', total.rows[0].count);
      console.log('Actives + en stock:', active.rows[0].count);
      console.log('Échantillon:', sample.rows);
      return;
    }

    if (arg === 'schema-partner-bons-zora') {
      const r = await client.query(
        "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'partner_bons_zora' ORDER BY ordinal_position"
      );
      console.log(r.rows);
      return;
    }

    if (arg === 'schema-follows') {
      const r = await client.query(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'follows' ORDER BY ordinal_position"
      );
      console.log(r.rows);
      return;
    }

    // Défaut : état des 2 comptes de test A.1
    console.log('ID 62 (Test Zora, compte A):', await checkPhone(client, PHONE_A));
    console.log('ID 225 (Sarah Test, visiteur B):', await checkPhone(client, PHONE_B));
  } finally {
    client.release();
    await pool.end();
  }
}

main();
