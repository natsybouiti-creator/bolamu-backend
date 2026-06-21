// ============================================================
// BOLAMU — Sprint 2 : Cron Expiration Zora Points
// ============================================================
// Job quotidien à 02h00 heure Congo (UTC+1)
// Expirer les lignes ledger échues et recalculer les soldes
// ============================================================

const pool = require('../config/db');
const { getZoraTiers } = require('../services/zora.service');

/**
 * Fonction principale d'expiration
 */
async function runExpiration() {
  const client = await pool.connect();
  
  try {
    console.log('[ZORA CRON] Début expiration à', new Date().toISOString());
    await client.query('BEGIN');
    
    // ÉTAPE 1 — Expirer les vouchers échus
    const voucherExpireResult = await client.query(
      `UPDATE zora_vouchers 
       SET status = 'expired' 
       WHERE status = 'active' AND expires_at < NOW()
       RETURNING id, phone`
    );
    
    console.log(`[ZORA CRON] ${voucherExpireResult.rows.length} vouchers expirés`);
    
    // ÉTAPE 2 — Expirer les lignes ledger échues
    const expireResult = await client.query(
      `UPDATE zora_ledger 
       SET verified = FALSE 
       WHERE expires_at < NOW() AND verified = TRUE
       RETURNING id, phone, points`
    );
    
    console.log(`[ZORA CRON] ${expireResult.rows.length} lignes ledger expirées`);
    
    // ÉTAPE 3 — Recalculer le solde réel pour chaque utilisateur affecté
    const affectedPhones = new Set(expireResult.rows.map(r => r.phone));
    
    for (const phone of affectedPhones) {
      const balanceResult = await client.query(
        `UPDATE zora_points zp
         SET balance = COALESCE((
           SELECT SUM(points) 
           FROM zora_ledger 
           WHERE phone = zp.phone 
             AND points > 0 
             AND verified = TRUE
         ), 0),
         updated_at = NOW()
         WHERE phone = $1
         RETURNING balance, total_earned`,
        [phone]
      );
      
      if (balanceResult.rows.length > 0) {
        const points = balanceResult.rows[0];
        console.log(`[ZORA CRON] Solde recalculé pour ${phone}: ${points.balance} (total_earned: ${points.total_earned})`);
        
        // ÉTAPE 4 — Recalculer le tier après expiration
        const tiers = await getZoraTiers();
        let newTier = 'kimia';
        
        for (const tier of tiers) {
          if (points.total_earned >= tier.min_points) {
            newTier = tier.tier_name;
          }
        }
        
        await client.query(
          'UPDATE zora_points SET tier = $1 WHERE phone = $2',
          [newTier, phone]
        );
        
        console.log(`[ZORA CRON] Tier recalculé pour ${phone}: ${newTier}`);
      }
    }
    
    // Audit log
    await client.query(
      `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
       VALUES ('zora_expiration', 'system', 'zora_ledger', NULL, $1::jsonb)`,
      [JSON.stringify({
        expired_count: expireResult.rows.length,
        affected_phones: Array.from(affectedPhones),
        timestamp: new Date().toISOString()
      })]
    );
    
    await client.query('COMMIT');
    console.log('[ZORA CRON] Expiration terminée avec succès');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ZORA CRON] Erreur:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Scheduler avec node-cron
 */
function scheduleExpiration() {
  const cron = require('node-cron');
  
  // Exécuter tous les jours à 02h00 heure Congo (UTC+1)
  // En UTC, c'est 01h00
  cron.schedule('0 1 * * *', async () => {
    try {
      await runExpiration();
    } catch (error) {
      console.error('[ZORA CRON] Erreur lors de l\'exécution:', error);
    }
  });
  
  console.log('[ZORA CRON] Scheduler activé — exécution quotidienne à 01h00 UTC (02h00 Congo)');
}

// Export pour exécution manuelle ou scheduling
module.exports = {
  runExpiration,
  scheduleExpiration
};

// Exécution directe si appelé en ligne de commande
if (require.main === module) {
  runExpiration()
    .then(() => {
      console.log('[ZORA CRON] Exécution manuelle terminée');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[ZORA CRON] Erreur exécution manuelle:', error);
      process.exit(1);
    });
}
