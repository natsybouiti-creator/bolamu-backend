const pool = require('../src/config/db');

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
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'partner_bons_zora' ORDER BY ordinal_position"
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
