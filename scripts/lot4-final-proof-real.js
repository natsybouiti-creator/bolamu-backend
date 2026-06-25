const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function finalProofReal() {
  try {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM elonga_events 
         WHERE status = 'published') as events_publies,
        (SELECT COUNT(*) FROM event_registrations) as inscriptions,
        (SELECT COUNT(*) FROM event_checkin_log) as checkins,
        (SELECT COUNT(*) FROM elonga_points) as elonga_pts_distribues,
        (SELECT COUNT(*) FROM animateurs WHERE is_active = true) as animateurs_actifs,
        (SELECT COUNT(*) FROM notifications 
         WHERE canal = 'whatsapp' 
         AND sent_at IS NOT NULL) as wa_envoyes`
    );

    const data = result.rows[0];
    console.log('=== LOT 4 - PREUVE FINALE SQL (RÉELLE) ===\n');
    console.log(`events_publies: ${data.events_publies}`);
    console.log(`inscriptions: ${data.inscriptions}`);
    console.log(`checkins: ${data.checkins}`);
    console.log(`elonga_pts_distribues: ${data.elonga_pts_distribues}`);
    console.log(`animateurs_actifs: ${data.animateurs_actifs}`);
    console.log(`wa_envoyes: ${data.wa_envoyes}`);

    const checks = [
      { name: 'events_publies', value: data.events_publies, min: 1 },
      { name: 'inscriptions', value: data.inscriptions, min: 1 },
      { name: 'checkins', value: data.checkins, min: 1 },
      { name: 'elonga_pts_distribues', value: data.elonga_pts_distribues, min: 1 },
      { name: 'animateurs_actifs', value: data.animateurs_actifs, min: 1 }
    ];

    let failed = false;
    for (const check of checks) {
      if (check.value < check.min) {
        console.log(`\n❌ STOP: ${check.name} = ${check.value} (minimum requis: ${check.min})`);
        failed = true;
      }
    }

    if (!failed) {
      console.log('\n✅ LOT 4 - PREUVE FINALE VALIDÉE');
    }

  } catch (error) {
    console.error('❌ Erreur preuve finale:', error.message);
  } finally {
    await pool.end();
  }
}

finalProofReal();
