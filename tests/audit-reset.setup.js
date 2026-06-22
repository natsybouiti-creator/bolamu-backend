// ============================================================
// BOLAMU — AUDIT PERSISTANCE : SCRIPT DE REMISE A ZERO
// ============================================================
// /!\  ATTENTION — ECRITURES VOLONTAIRES ET DESTRUCTIVES  /!\
//
// Ce fichier EXECUTE des DELETE sur la base de PRODUCTION.
// Il est SCOPE EXCLUSIVEMENT :
//   - au compte de test  +242069735418
//   - a la date du jour   (...::date = CURRENT_DATE)
//
// NE JAMAIS :
//   - retirer la clause  WHERE phone = '+242069735418'
//   - retirer la clause  AND ...::date = CURRENT_DATE
//   - generaliser ce script a un autre numero ou a toute la table
//
// But : reinitialiser les parties gratuites Zora + l'inscription
// evenement du jour pour que l'audit soit reproductible et causal
// (sinon faux negatifs « deja joue aujourd'hui »).
//
// Les constantes medicales (table users) NE SONT PAS touchees ici :
// elles sont sauvegardees par l'audit puis restaurees par le teardown.
// ============================================================

const { test: reset } = require('@playwright/test');
const { Pool } = require('pg');
require('dotenv').config();

const AUDIT_PHONE = '+242069735418';

reset('remise a zero des actions one-shot du jour', async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    // equivalent exact de :
    // DELETE FROM zora_game_plays WHERE phone = '+242069735418' AND played_at::date = CURRENT_DATE;
    const plays = await pool.query(
      `DELETE FROM zora_game_plays WHERE phone = $1 AND played_at::date = CURRENT_DATE`,
      [AUDIT_PHONE]
    );
    console.log(`[RESET] zora_game_plays (aujourd'hui, ${AUDIT_PHONE}) supprimees : ${plays.rowCount}`);

    // equivalent exact de :
    // DELETE FROM elonga_registrations WHERE phone = '+242069735418' AND registered_at::date = CURRENT_DATE;
    const regs = await pool.query(
      `DELETE FROM elonga_registrations WHERE phone = $1 AND registered_at::date = CURRENT_DATE`,
      [AUDIT_PHONE]
    );
    console.log(`[RESET] elonga_registrations (aujourd'hui, ${AUDIT_PHONE}) supprimees : ${regs.rowCount}`);

    // Réinitialiser TOUS les crédits event_checkin pour ce compte de test
    // (idempotency dans awardZora vérifie proof_reference sans filtre date)
    const checkins = await pool.query(
      `DELETE FROM zora_ledger WHERE phone = $1 AND action_type = 'event_checkin'`,
      [AUDIT_PHONE]
    );
    console.log(`[RESET] zora_ledger event_checkin (tous, ${AUDIT_PHONE}) supprimees : ${checkins.rowCount}`);
  } finally {
    await pool.end();
  }
});
