// ============================================================
// BOLAMU — AUDIT PERSISTANCE AUTOMATISE
// ============================================================
// Verifie empiriquement que les actions patient a effet persistant
// ecrivent reellement en base. Pour chaque action :
//   1) lit l'etat AVANT (SELECT)
//   2) declenche l'action via Playwright (UI reelle)
//   3) relit l'etat APRES (SELECT)
//   4) compare et consigne le verdict
//
// COTE BASE DE DONNEES : ce spec ne fait QUE des SELECT.
// La seule ecriture est un fichier LOCAL temporaire
// (tests/.audit-const-backup.json) sauvegardant les constantes
// d'origine, restaurees ensuite par le projet `restore` (teardown).
//
// Pre-requis (geres par playwright.config.js) :
//   - projet `setup`  : injecte le token patient (storageState)
//   - projet `reset`  : DELETE des actions one-shot du jour
//   - projet `restore`: UPDATE de restauration des constantes (teardown)
// ============================================================

const { test } = require('@playwright/test');
const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PHONE = '+242069735418';
const DASHBOARD = 'https://bolamu.co/patient/dashboard-v3-design.html';
const BACKUP_PATH = 'tests/.audit-const-backup.json';

// --- Helpers SQL (lecture seule) ---
const playsToday = (gt) =>
  `SELECT COUNT(*)::int AS n FROM zora_game_plays p ` +
  `JOIN zora_games g ON p.game_id = g.id ` +
  `WHERE p.phone = '${PHONE}' AND g.game_type = '${gt}' AND p.played_at::date = CURRENT_DATE`;

const regsToday =
  `SELECT COUNT(*)::int AS n FROM elonga_registrations ` +
  `WHERE phone = '${PHONE}' AND registered_at::date = CURRENT_DATE`;

const constSelect =
  `SELECT poids, taille, groupe_sanguin, allergies, maladies_chroniques, ` +
  `antecedents_medicaux, traitements_en_cours, ` +
  `contact_urgence_nom, contact_urgence_phone, contact_urgence_lien ` +
  `FROM users WHERE phone = '${PHONE}'`;

// --- Helper UI : repart d'un dashboard propre avant chaque action ---
// NB: les data-testid de navigation existent en double (top-nav + bottom-nav),
// d'ou l'usage systematique de .first() pour eviter le strict-mode Playwright.
async function gotoFresh(page) {
  await page.goto(DASHBOARD, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="nav-accueil"]', { timeout: 20000 });
  await page.waitForTimeout(1500); // laisse le temps aux fetch GET (profil, events, config)
}

async function nav(page, testid) {
  await page.locator(`[data-testid="${testid}"]`).first().click();
}

// --- Action jeu generique : ouvre Recompenses, lance le jeu, declenche le coup ---
async function playGameUI(page, gameKey, triggerSelector, waitMs) {
  await gotoFresh(page);
  await nav(page, 'nav-recompenses');
  await page.waitForTimeout(1200);
  await page.locator(`[data-testid="play-${gameKey}"]`).first().click();
  await page.waitForTimeout(600);
  await page.locator(triggerSelector).first().click();
  await page.waitForTimeout(waitMs);
}

const cases = [
  // ====================== ACTIONS A EFFET PERSISTANT (testables via UI) ======================
  {
    name: 'Jeu Roue Zora (spinWheel)',
    before: playsToday('wheel'),
    after: playsToday('wheel'),
    action: async (page) => {
      await playGameUI(page, 'wheel', '[data-testid="wheel-spin"]', 4000);
    }
  },
  {
    name: 'Jeu Coffre Zora (openChest)',
    before: playsToday('chest'),
    after: playsToday('chest'),
    action: async (page) => {
      await playGameUI(page, 'chest', '[data-testid="chest-0"]', 2500);
    }
  },
  {
    name: 'Jeu Mayele Quiz (pickQuiz)',
    before: playsToday('quiz'),
    after: playsToday('quiz'),
    action: async (page) => {
      await playGameUI(page, 'quiz', '[data-testid="quiz-opt-0"]', 2500);
    }
  },
  {
    name: 'Jeu Grattage Zora (scratch canvas)',
    before: playsToday('scratch'),
    after: playsToday('scratch'),
    action: async (page) => {
      await gotoFresh(page);
      await nav(page, 'nav-recompenses');
      await page.waitForTimeout(1200);
      await page.locator('[data-testid="play-scratch"]').first().click();
      const canvas = page.locator('#scratch-canvas');
      await canvas.waitFor({ state: 'visible', timeout: 8000 });
      const box = await canvas.boundingBox();
      // Balayage dense pour depasser 55% gratte -> reveal() -> playScratch()
      await page.mouse.move(box.x + 5, box.y + 5);
      await page.mouse.down();
      const rows = 14;
      for (let r = 0; r < rows; r++) {
        const y = box.y + (box.height * (r + 0.5)) / rows;
        await page.mouse.move(box.x + 5, y);
        await page.mouse.move(box.x + box.width - 5, y, { steps: 20 });
      }
      await page.mouse.up();
      await page.waitForTimeout(2500);
    }
  },
  {
    name: 'Inscription evenement Elonga (participate)',
    before: regsToday,
    after: regsToday,
    action: async (page) => {
      await gotoFresh(page);
      // Recupere les ids d'evenements rendus sur la page
      const ids = await page
        .locator('[data-testid^="participate-"]')
        .evaluateAll((els) =>
          els.map((e) => e.getAttribute('data-testid').replace('participate-', ''))
        );
      if (!ids.length) throw new Error('aucun evenement rendu sur le dashboard');
      // Choisit un evenement causalement testable : non deja inscrit
      let target = null;
      for (const id of ids) {
        const r = await pool.query(
          `SELECT 1 FROM elonga_registrations WHERE event_id = $1 AND phone = $2`,
          [id, PHONE]
        );
        if (r.rowCount === 0) { target = id; break; }
      }
      if (!target) throw new Error('tous les evenements rendus sont deja inscrits');
      await page.click(`[data-testid="participate-${target}"]`);
      await page.waitForTimeout(2500);
    }
  },
  {
    name: 'Constantes medicales (saveConst)',
    before: constSelect,
    after: constSelect,
    action: async (page) => {
      await gotoFresh(page);
      // Sauvegarde des constantes d'origine dans un fichier LOCAL (pas la DB)
      const orig = (await pool.query(constSelect)).rows[0] || {};
      fs.writeFileSync(BACKUP_PATH, JSON.stringify(orig));
      try {
        await nav(page, 'nav-suivre');
        await page.waitForTimeout(600);
        await page.locator('[data-testid="btn-dossier-medical"]').first().click();
        await page.waitForTimeout(600);
        await page.locator('[data-testid="const-edit"]').first().click();
        const input = page.locator('[data-testid="const-poids"]');
        await input.waitFor({ state: 'visible', timeout: 6000 });
        const newPoids = Number(orig.poids) === 70 ? 71 : 70;
        await input.fill(String(newPoids));
        await page.click('[data-testid="const-save"]');
        await page.waitForTimeout(2500);
      } finally {
        // Garantit que le backup reste present meme si l'UI plante en cours de route,
        // pour que le teardown `restore` puisse toujours restaurer le profil.
        if (!fs.existsSync(BACKUP_PATH)) {
          fs.writeFileSync(BACKUP_PATH, JSON.stringify(orig));
        }
      }
    }
  }

  // ====================== ACTIONS NON CABLEES / AMBIGUES (non testables) ======================
  // Les actions suivantes de l'inventaire ont un effet persistant POTENTIEL mais
  // AUCUNE logique JS cablee dans le frontend (boutons statiques sans onclick).
  // Impossible de les declencher via Playwright sans deviner un selecteur fragile.
  // Elles relevent d'un travail backend/frontend a part, hors de cet audit :
  //   - #24 Prendre RDV (consultation)        -> table appointments ? (a confirmer)
  //   - #25 Reserver analyse labo             -> table lab_bookings ? (a confirmer)
  //   - #26 Planifier bilan annuel            -> table appointments ? (a confirmer)
  //   - #27 Inviter via WhatsApp (parrainage) -> table referrals ? (a confirmer)
  //   - #34 Convertir en Zora Cash (MoMo)     -> table momo_payouts ? (a confirmer)
  //   - #56-58 Chat (commenter/suivre/envoyer)-> table communaute/messages ? (a confirmer)
  //   - #61 Confirmer RDV (modal)             -> table appointments ? (a confirmer)
];

test.describe.configure({ mode: 'serial' });

test('Audit persistance complet — actions a effet persistant', async ({ page }) => {
  test.setTimeout(600000);
  page.setDefaultTimeout(15000);
  const results = [];

  for (const c of cases) {
    try {
      const before = (await pool.query(c.before)).rows;
      await c.action(page);
      const after = (await pool.query(c.after)).rows;
      const changed = JSON.stringify(before) !== JSON.stringify(after);
      results.push({
        name: c.name,
        before: JSON.stringify(before),
        after: JSON.stringify(after),
        verdict: changed ? '✅ PERSISTE' : '❌ NON PERSISTE'
      });
    } catch (e) {
      results.push({ name: c.name, before: '-', after: '-', verdict: `⚠️ ERREUR: ${e.message}` });
    }
  }

  const ok = results.filter((r) => r.verdict.includes('✅')).length;
  let report = `# Audit persistance automatise — ${new Date().toISOString()}\n\n`;
  report += `**Compte audite : ${PHONE}**\n\n`;
  report += `**Score : ${ok}/${results.length} actions persistees**\n\n`;
  report += '| Action | Avant | Apres | Verdict |\n|---|---|---|---|\n';
  results.forEach((r) => {
    report += `| ${r.name} | \`${r.before}\` | \`${r.after}\` | ${r.verdict} |\n`;
  });
  report += '\n> Les constantes medicales modifiees pendant l\'audit sont restaurees ';
  report += 'a leur valeur d\'origine par le projet `restore` (teardown).\n';

  fs.writeFileSync('docs/AUDIT_PERSISTANCE_AUTO.md', report);
  console.log('\n' + report);

  await pool.end();
});
