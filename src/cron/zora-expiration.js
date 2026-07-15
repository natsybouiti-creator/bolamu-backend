// ============================================================
// BOLAMU — Sprint 2 : Cron Expiration Zora Points
// ============================================================
// Job quotidien à 02h00 heure Congo (UTC+1)
// Expirer les lignes ledger échues et recalculer les soldes
// ============================================================

const pool = require('../config/db');
const { getZoraTiers, recalculateBalance } = require('../services/zora.service');

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
    // Corrigé (audit Gagner/Santé, 15 juillet 2026) : la formule inline
    // (SUM filtré points>0 AND verified=TRUE) divergeait de recalculateBalance()
    // — la formule utilisée par awardZora() (SUM de TOUTE la ligne ledger, y
    // compris les débits négatifs de rachat/bons Zora). Réutilise désormais
    // recalculateBalance() pour ne jamais avoir deux définitions du solde.
    const affectedPhones = new Set(expireResult.rows.map(r => r.phone));

    for (const phone of affectedPhones) {
      const { balance } = await recalculateBalance(phone);
      console.log(`[ZORA CRON] Solde recalculé pour ${phone}: ${balance}`);

      const totalEarnedResult = await client.query(
        'SELECT total_earned FROM zora_points WHERE phone = $1',
        [phone]
      );
      const totalEarned = totalEarnedResult.rows[0]?.total_earned || 0;

      // ÉTAPE 4 — Recalculer le tier après expiration
      const tiers = await getZoraTiers();
      let newTier = 'kimia';

      for (const tier of tiers) {
        if (totalEarned >= tier.min_points) {
          newTier = tier.tier_name;
        }
      }

      await client.query(
        'UPDATE zora_points SET tier = $1 WHERE phone = $2',
        [newTier, phone]
      );

      console.log(`[ZORA CRON] Tier recalculé pour ${phone}: ${newTier}`);
    }

    // ÉTAPE 5 — Détection + correction des dérives balance vs ledger, tous
    // comptes confondus (pas seulement ceux affectés par une expiration du
    // jour). Cf. audit Gagner/Santé du 15 juillet 2026 : une dérive de 2150
    // points trouvée sur un compte, provenant d'une écriture directe en base
    // hors du chemin awardZora()/recalculateBalance().
    const driftResult = await client.query(
      `SELECT zp.phone, zp.balance AS balance_stockee, COALESCE(SUM(zl.points), 0) AS somme_ledger
       FROM zora_points zp
       LEFT JOIN zora_ledger zl ON zl.phone = zp.phone
       GROUP BY zp.phone, zp.balance
       HAVING zp.balance <> COALESCE(SUM(zl.points), 0)`
    );

    if (driftResult.rows.length > 0) {
      console.warn(`[ZORA CRON] ⚠️  ${driftResult.rows.length} compte(s) avec dérive balance/ledger détectée(s)`);
      for (const row of driftResult.rows) {
        console.warn(`[ZORA CRON] Dérive ${row.phone} : balance=${row.balance_stockee}, ledger=${row.somme_ledger}, écart=${row.balance_stockee - row.somme_ledger}`);
        await client.query(
          `INSERT INTO audit_log (event_type, actor_phone, target_table, target_id, payload)
           VALUES ('zora_balance_drift_detected', 'system', 'zora_points', NULL, $1::jsonb)`,
          [JSON.stringify({
            phone: row.phone,
            balance_stockee: row.balance_stockee,
            somme_ledger: row.somme_ledger,
            ecart: row.balance_stockee - row.somme_ledger
          })]
        );
        await recalculateBalance(row.phone);
      }
    } else {
      console.log('[ZORA CRON] Aucune dérive balance/ledger détectée');
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
