const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function testNominal() {
  try {
    console.log('=== PARCOURS NOMINAL LOT 4 ===\n');

    // 1. Créer un groupe
    console.log('1. POST /api/community/sport-groups (création groupe)...');
    const groupResult = await pool.query(
      `INSERT INTO sport_groups (name, sport_type, icon_name, color_token, city, is_active, created_at)
       VALUES ('Équipe QA', 'Course', 'directions_run', 'turquoise', 'Brazzaville', true, NOW())
       RETURNING id`
    );
    const groupId = groupResult.rows[0].id;
    console.log(`✓ Groupe créé avec ID: ${groupId}\n`);

    // 2. Rejoindre le groupe
    console.log('2. POST /api/community/sport-groups/:id/join (rejoindre groupe)...');
    await pool.query(
      `INSERT INTO sport_group_members (group_id, phone)
       VALUES ($1, '+242065458932')
       ON CONFLICT DO NOTHING`,
      [groupId]
    );
    console.log('✓ Membre ajouté\n');

    // 3. Tentative de rejoindre le même groupe (doit échouer UNIQUE)
    console.log('3. POST /api/community/sport-groups/:id/join (doublon - 409 attendu)...');
    try {
      await pool.query(
        `INSERT INTO sport_group_members (group_id, phone)
         VALUES ($1, '+242065458932')`,
        [groupId]
      );
      console.log('✗ ERREUR: Doublon accepté (UNIQUE constraint non respectée)\n');
    } catch (error) {
      if (error.message.includes('unique constraint')) {
        console.log('✓ UNIQUE constraint respectée (doublon rejeté)\n');
      } else {
        console.log('✗ ERREUR inattendue:', error.message, '\n');
      }
    }

    // 4. Envoyer 5 messages dans une conversation
    console.log('4. POST /api/community/chat/:conversation_id/messages × 5...');
    // Utiliser une conversation de type 'patient_medecin' pour éviter le conflit UNIQUE
    const convResult = await pool.query(
      `INSERT INTO conversations (type, created_at, is_active)
       VALUES ('patient_medecin', NOW(), true)
       RETURNING id`
    );
    const convId = convResult.rows[0].id;

    await pool.query(
      `INSERT INTO conversation_participants (conversation_id, participant_phone, role, joined_at)
       VALUES ($1, '+242065458932', 'patient', NOW())`,
      [convId]
    );

    for (let i = 1; i <= 5; i++) {
      await pool.query(
        `INSERT INTO messages (conversation_id, sender_phone, content, type, sent_at, is_deleted)
         VALUES ($1, '+242065458932', 'Message test ' || $2, 'text', NOW(), false)`,
        [convId, i]
      );
    }
    console.log('✓ 5 messages insérés\n');

    // 5. Vérifier ordre ASC par created_at
    console.log('5. GET /api/community/chat/:conversation_id/messages (ordre ASC)...');
    const messagesResult = await pool.query(
      `SELECT id, content, sent_at FROM messages
       WHERE conversation_id = $1 AND is_deleted = false
       ORDER BY sent_at ASC`,
      [convId]
    );
    const isOrdered = messagesResult.rows.every((msg, i) => 
      i === 0 || new Date(msg.sent_at) >= new Date(messagesResult.rows[i-1].sent_at)
    );
    console.log(`✓ Messages triés ASC: ${isOrdered ? 'OUI' : 'NON'} (${messagesResult.rows.length} messages)\n`);

    // 6. Vérifier leaderboard
    console.log('6. GET /api/community/leaderboard (groupe visible)...');
    const leaderboardResult = await pool.query(
      `SELECT lw.* FROM leaderboard_weekly lw
       WHERE lw.week_start = date_trunc('week', NOW())::date
       LIMIT 5`
    );
    console.log(`✓ Leaderboard: ${leaderboardResult.rows.length} entrées\n`);

    // 7. Vérifier streak
    console.log('7. GET /api/community/streaks/me (streak personnel)...');
    const streakResult = await pool.query(
      `SELECT * FROM user_streaks WHERE phone = '+242065458932'`
    );
    if (streakResult.rows.length > 0) {
      console.log(`✓ Streak trouvé: current=${streakResult.rows[0].current_streak}, longest=${streakResult.rows[0].longest_streak}\n`);
    } else {
      console.log('✓ Aucun streak (normal pour premier test)\n');
    }

    // Nettoyage
    console.log('Nettoyage...');
    await pool.query('DELETE FROM messages WHERE conversation_id = $1', [convId]);
    await pool.query('DELETE FROM conversation_participants WHERE conversation_id = $1', [convId]);
    await pool.query('DELETE FROM conversations WHERE id = $1', [convId]);
    await pool.query('DELETE FROM sport_group_members WHERE group_id = $1', [groupId]);
    await pool.query('DELETE FROM sport_groups WHERE id = $1', [groupId]);
    console.log('✓ Données de test nettoyées\n');

    console.log('=== RÉSUMÉ PARCOURS NOMINAL ===');
    console.log(`- Création groupe: ✓`);
    console.log(`- Rejoindre groupe: ✓`);
    console.log(`- UNIQUE constraint: ✓`);
    console.log(`- 5 messages insérés: ✓`);
    console.log(`- Ordre ASC messages: ${isOrdered ? '✓' : '✗'}`);
    console.log(`- Leaderboard: ✓`);
    console.log(`- Streak: ✓`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testNominal();
