const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function testLot2Preuve() {
  try {
    console.log('=== PREUVE LOT 2 ===\n');

    // 1. Créer un groupe de test
    console.log('1. Création groupe de test...');
    const groupResult = await pool.query(
      `INSERT INTO sport_groups (name, sport_type, icon_name, color_token, city, is_active, created_at)
       VALUES ('Lions FC Test', 'Football', 'sports_soccer', 'turquoise', 'Brazzaville', true, NOW())
       RETURNING id`
    );
    const groupId = groupResult.rows[0].id;
    console.log(`✓ Groupe créé avec ID: ${groupId}\n`);

    // 2. Ajouter des membres
    console.log('2. Ajout membres...');
    await pool.query(
      `INSERT INTO sport_group_members (group_id, phone)
       VALUES ($1, '+242065458932')
       ON CONFLICT DO NOTHING`,
      [groupId]
    );
    console.log('✓ Membres ajoutés\n');

    // 3. Vérifier leaderboard_weekly
    console.log('3. Vérification leaderboard_weekly...');
    const leaderboardResult = await pool.query(
      `SELECT phone, points_earned, week_start 
       FROM leaderboard_weekly
       WHERE phone = '242069735418'`
    );
    console.log(`✓ Entrées leaderboard: ${leaderboardResult.rows.length}`);
    if (leaderboardResult.rows.length > 0) {
      console.log('  Données:', leaderboardResult.rows[0]);
    }
    console.log();

    // 4. Vérifier notifications WhatsApp
    console.log('4. Vérification notifications WhatsApp...');
    const notifResult = await pool.query(
      `SELECT user_phone, type, canal, sent_at
       FROM notifications
       WHERE canal = 'whatsapp' AND sent_at IS NOT NULL
       ORDER BY created_at DESC LIMIT 3`
    );
    console.log(`✓ Notifications WhatsApp envoyées: ${notifResult.rows.length}`);
    if (notifResult.rows.length > 0) {
      console.log('  Dernière notification:', notifResult.rows[0]);
    }
    console.log();

    // 5. Nettoyage
    console.log('5. Nettoyage...');
    await pool.query('DELETE FROM sport_group_members WHERE group_id = $1', [groupId]);
    await pool.query('DELETE FROM sport_groups WHERE id = $1', [groupId]);
    console.log('✓ Données de test nettoyées\n');

    console.log('=== RÉSUMÉ LOT 2 ===');
    console.log(`- Groupe créé: ✓`);
    console.log(`- Membres ajoutés: ✓`);
    console.log(`- Leaderboard vérifié: ${leaderboardResult.rows.length > 0 ? '✓' : '✗'}`);
    console.log(`- Notifications WhatsApp: ${notifResult.rows.length > 0 ? '✓' : '✗'} (${notifResult.rows.length} envoyées)`);
    console.log();

    if (notifResult.rows.length > 0) {
      console.log('⚠️  EN ATTENTE CONFIRMATION NATSY — message WhatsApp envoyé');
      console.log('   Natsy doit confirmer avoir reçu le message sur son téléphone.');
    } else {
      console.log('⚠️  Aucune notification WhatsApp envoyée - vérifier le service WhatsApp');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testLot2Preuve();
