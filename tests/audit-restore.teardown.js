// ============================================================
// BOLAMU — AUDIT PERSISTANCE : RESTAURATION DES CONSTANTES
// ============================================================
// /!\  ECRITURE VOLONTAIRE — UPDATE SCOPE a +242069735418 UNIQUEMENT  /!\
//
// Restaure les constantes medicales d'origine du compte de test,
// sauvegardees par l'audit AVANT modification, pour ne pas laisser
// le profil demo dans un etat modifie apres le run.
//
// Lit le fichier local  tests/.audit-const-backup.json  ecrit par le
// spec d'audit. Si absent -> ne fait RIEN (aucune ecriture).
//
// Ce projet est branche en `teardown` du projet `chromium` dans
// playwright.config.js : il s'execute APRES l'audit, que les tests
// reussissent ou echouent.
// ============================================================

const { test: restore } = require('@playwright/test');
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const AUDIT_PHONE = '+242069735418';
const BACKUP_PATH = 'tests/.audit-const-backup.json';

restore("restauration des constantes medicales d'origine", async () => {
  if (!fs.existsSync(BACKUP_PATH)) {
    console.log('[RESTORE] Aucun backup trouve — rien a restaurer.');
    return;
  }
  const o = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(
      `UPDATE users SET
         groupe_sanguin = $1, allergies = $2, maladies_chroniques = $3,
         antecedents_medicaux = $4, traitements_en_cours = $5,
         poids = $6, taille = $7,
         contact_urgence_nom = $8, contact_urgence_phone = $9, contact_urgence_lien = $10
       WHERE phone = $11`,
      [o.groupe_sanguin, o.allergies, o.maladies_chroniques,
       o.antecedents_medicaux, o.traitements_en_cours,
       o.poids, o.taille,
       o.contact_urgence_nom, o.contact_urgence_phone, o.contact_urgence_lien,
       AUDIT_PHONE]
    );
    console.log(`[RESTORE] Constantes restaurees pour ${AUDIT_PHONE}.`);
    fs.unlinkSync(BACKUP_PATH);
    console.log('[RESTORE] Backup local supprime — cycle termine proprement.');
  } finally {
    await pool.end();
  }
});
