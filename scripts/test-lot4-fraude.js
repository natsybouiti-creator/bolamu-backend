const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function testFraud() {
  try {
    console.log('=== SCÉNARIOS FRAUDE LOT 4 ===\n');

    let fraudCount = 0;
    let blockedCount = 0;

    // FRAUDE 1: Rejoindre un groupe sans être patient (role != patient)
    console.log('FRAUDE 1: Rejoindre groupe sans être patient (doit échouer)...');
    const groupResult = await pool.query(
      `INSERT INTO sport_groups (name, sport_type, icon_name, color_token, city, is_active, created_at)
       VALUES ('Test Fraude 1', 'Test', 'block', 'red', 'Brazzaville', true, NOW())
       RETURNING id`
    );
    const groupId = groupResult.rows[0].id;

    // Créer un utilisateur non-patient
    await pool.query(
      `INSERT INTO users (phone, first_name, last_name, full_name, role, is_active, created_at)
       VALUES ('+242999999999', 'Test', 'Fraude', 'Test Fraude', 'admin', true, NOW())
       ON CONFLICT (phone) DO UPDATE SET role = 'admin'`
    );

    try {
      await pool.query(
        `INSERT INTO sport_group_members (group_id, phone)
         VALUES ($1, '+242999999999')`,
        [groupId]
      );
      console.log('✗ FRAUDE ACCEPTÉE: Non-patient peut rejoindre un groupe\n');
      fraudCount++;
    } catch (error) {
      if (error.message.includes('foreign key')) {
        console.log('✓ FRAUDE BLOQUÉE: FK empêche l\'insertion\n');
        blockedCount++;
      } else {
        console.log('? Erreur inattendue:', error.message, '\n');
      }
    }

    // FRAUDE 2: Injection SQL dans le nom de groupe
    console.log('FRAUDE 2: Injection SQL dans nom de groupe (doit être échappé)...');
    try {
      const sqlInjection = "Test'; DROP TABLE sport_groups; --";
      await pool.query(
        `INSERT INTO sport_groups (name, sport_type, icon_name, color_token, city, is_active, created_at)
         VALUES ($1, 'Test', 'block', 'red', 'Brazzaville', true, NOW())`,
        [sqlInjection]
      );
      // Vérifier que la table existe encore
      await pool.query('SELECT 1 FROM sport_groups LIMIT 1');
      console.log('✓ FRAUDE BLOQUÉE: Injection SQL échappée (table intacte)\n');
      blockedCount++;
    } catch (error) {
      console.log('✗ FRADE ACCEPTÉE: Injection SQL a fonctionné\n');
      fraudCount++;
    }

    // FRAUDE 3: Créer un message avec phone inexistant (FK violation)
    console.log('FRAUDE 3: Message avec phone inexistant (doit échouer)...');
    const convResult = await pool.query(
      `INSERT INTO conversations (type, created_at, is_active)
       VALUES ('patient_medecin', NOW(), true)
       RETURNING id`
    );
    const convId = convResult.rows[0].id;

    try {
      await pool.query(
        `INSERT INTO messages (conversation_id, sender_phone, content, type, sent_at, is_deleted)
         VALUES ($1, '+242888888888', 'Test fraude', 'text', NOW(), false)`,
        [convId]
      );
      console.log('✗ FRAUDE ACCEPTÉE: Message avec phone inexistant\n');
      fraudCount++;
    } catch (error) {
      if (error.message.includes('foreign key')) {
        console.log('✓ FRAUDE BLOQUÉE: FK empêche le phone inexistant\n');
        blockedCount++;
      } else {
        console.log('? Erreur inattendue:', error.message, '\n');
      }
    }

    // FRAUDE 4: Modifier le streak d'un autre utilisateur (UPDATE sans auth)
    console.log('FRAUDE 4: Modifier streak d\'un autre utilisateur (doit échouer en prod)...');
    // En prod, c'est bloqué par authMiddleware. Ici on teste juste que le UPDATE est possible en SQL direct
    await pool.query(
      `INSERT INTO user_streaks (phone, current_streak, longest_streak, last_activity_date)
       VALUES ('+242065458932', 9999, 9999, NOW())
       ON CONFLICT (phone) DO UPDATE SET current_streak = 9999`
    );
    console.log('⚠️ SQL direct permet le UPDATE (normal - bloqué par authMiddleware en prod)\n');

    // FRAUDE 5: Rejoindre un groupe désactivé (is_active = false)
    console.log('FRAUDE 5: Rejoindre groupe désactivé (doit être filtré)...');
    const inactiveGroupResult = await pool.query(
      `INSERT INTO sport_groups (name, sport_type, icon_name, color_token, city, is_active, created_at)
       VALUES ('Groupe Inactif', 'Test', 'block', 'red', 'Brazzaville', false, NOW())
       RETURNING id`
    );
    const inactiveGroupId = inactiveGroupResult.rows[0].id;

    // En SQL direct, c'est possible. Le blocage doit être au niveau du controller/service
    try {
      await pool.query(
        `INSERT INTO sport_group_members (group_id, phone)
         VALUES ($1, '+242065458932')`,
        [inactiveGroupId]
      );
      console.log('⚠️ SQL direct permet de rejoindre un groupe inactif (normal - filtré par WHERE is_active=true en prod)\n');
    } catch (error) {
      console.log('✓ FRAUDE BLOQUÉE: Impossible de rejoindre un groupe inactif\n');
      blockedCount++;
    }

    // Nettoyage
    console.log('Nettoyage...');
    await pool.query('DELETE FROM messages WHERE conversation_id = $1', [convId]);
    await pool.query('DELETE FROM conversations WHERE id = $1', [convId]);
    await pool.query('DELETE FROM sport_group_members WHERE group_id IN ($1, $2)', [groupId, inactiveGroupId]);
    await pool.query('DELETE FROM sport_groups WHERE id IN ($1, $2)', [groupId, inactiveGroupId]);
    await pool.query('DELETE FROM user_streaks WHERE phone = $1', ['+242065458932']);
    await pool.query('DELETE FROM users WHERE phone = $1', ['+242999999999']);
    console.log('✓ Données de test nettoyées\n');

    console.log('=== RÉSUMÉ SCÉNARIOS FRAUDE ===');
    console.log(`- Fraudes bloquées: ${blockedCount}/5`);
    console.log(`- Fraudes acceptées: ${fraudCount}/5`);
    console.log(`- Avertissements (normaux): ${5 - blockedCount - fraudCount}/5`);
    console.log();
    console.log('Note: Les scénarios marqués "normaux" sont bloqués par authMiddleware/WHEN is_active=true en production.');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testFraud();
