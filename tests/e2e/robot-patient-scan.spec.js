// ============================================================
// BOLAMU — Robot scan boutons dashboard patient
// Constate uniquement. Ne corrige rien. Ne modifie rien.
// ============================================================
import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const REPORT_PATH = path.resolve(process.cwd(), 'RAPPORT_BOUTONS_PATIENT.md');

const WEB_BASE = 'https://www.bolamu.co';
const PHONE    = '+242069735418';
const PASSWORD = 'TestNouveau2026!';

test.setTimeout(600000);

test('Robot scan — tous les boutons du dashboard patient', async ({ page }) => {
  // ── 1. Capteurs d'erreur AVANT toute navigation ──────────────
  const consoleErrors = [];
  page.on('pageerror', err => {
    consoleErrors.push(`[pageerror] ${err.message}`);
  });
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(`[console.error] ${msg.text()}`);
  });

  // ── 2. Connexion ─────────────────────────────────────────────
  await page.goto(`${WEB_BASE}/login.html`, { waitUntil: 'networkidle' });
  await page.fill('#phone-input', PHONE);
  await page.fill('#password-input', PASSWORD);
  await page.click('#btn-login');

  let loginOk = false;
  try {
    await page.waitForURL(/dashboard/, { timeout: 20000 });
    loginOk = true;
  } catch (e) {
    const rapport = [
      '# Rapport Robot Scan — Dashboard Patient',
      `Date : ${new Date().toISOString().slice(0, 10)}`,
      '',
      '## RÉSULTAT : ÉCHEC LOGIN',
      '',
      `Connexion impossible : ${e.message}`,
      '',
      '### Erreurs console au moment de l\'échec',
      ...consoleErrors.map(err => `- ${err}`),
    ].join('\n');
    fs.writeFileSync(REPORT_PATH, rapport, 'utf8');
    throw new Error(`Login échoué — rapport écrit dans ${REPORT_PATH}`);
  }

  // ── 3. Dashboard — chargement complet ────────────────────────
  await page.goto(`${WEB_BASE}/patient/dashboard.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const loadErrors = [...consoleErrors];
  consoleErrors.length = 0;

  // ── 4. Recenser tous les boutons ─────────────────────────────
  const buttonDescriptors = await page.evaluate(() => {
    const seen   = new Set();
    const result = [];

    // Priorité 1 : éléments avec data-testid (visibles ou non — on les teste tous)
    document.querySelectorAll('[data-testid]').forEach(el => {
      const tid  = el.getAttribute('data-testid');
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      const key  = `testid:${tid}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ selector: `[data-testid="${tid}"]`, label: tid, text });
      }
    });

    // Priorité 2 : <button> visibles sans data-testid
    let btnIdx = 0;
    document.querySelectorAll('button').forEach(el => {
      if (el.hasAttribute('data-testid')) { btnIdx++; return; }
      const style  = window.getComputedStyle(el);
      const hidden = style.display === 'none' || style.visibility === 'hidden';
      if (hidden) { btnIdx++; return; }
      const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
      const key  = `btn:${text}:${btnIdx}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ selector: null, index: btnIdx, label: `[btn] ${text || '(sans texte)'}`, text });
      }
      btnIdx++;
    });

    return result;
  });

  // ── 5. Cliquer chaque bouton et relever ──────────────────────
  const rows = [];

  const tryCloseModals = async () => {
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(250);
    const closeBtn = page.locator('button:visible').filter({ hasText: /^(fermer|annuler|close)$/i }).first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(200);
    }
  };

  for (const desc of buttonDescriptors) {
    // Remettre sur le dashboard si navigation accidentelle
    if (!page.url().includes('dashboard')) {
      await page.goto(`${WEB_BASE}/patient/dashboard.html`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
    }

    consoleErrors.length = 0;

    const domBefore = await page.evaluate(() => document.body.innerHTML.length).catch(() => 0);

    let clicked     = false;
    let clickNote   = '';
    let toastModal  = '';

    try {
      let locator;
      if (desc.selector) {
        locator = page.locator(desc.selector).first();
      } else {
        locator = page.locator('button').nth(desc.index);
      }

      const isVisible = await locator.isVisible({ timeout: 1500 }).catch(() => false);
      if (!isVisible) {
        rows.push({ label: desc.label, clicked: '— (non visible)', toastModal: '', erreurs: '', verdict: '⚠️ non visible' });
        continue;
      }

      await locator.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      await locator.click({ timeout: 3000 }).catch(async (firstErr) => {
        await locator.click({ timeout: 2000, force: true }).catch(() => {
          clickNote = firstErr.message.slice(0, 100);
        });
      });
      clicked = true;

    } catch (e) {
      clickNote = e.message.slice(0, 100);
    }

    await page.waitForTimeout(900);

    // Détecter toast / modal visible
    toastModal = await page.evaluate(() => {
      // Toasts : éléments avec background coloré et position fixe/absolute courts
      const allFixed = [...document.querySelectorAll('*')].filter(el => {
        const s = window.getComputedStyle(el);
        return (s.position === 'fixed' || s.position === 'absolute') &&
               s.display !== 'none' && s.visibility !== 'hidden' &&
               el.offsetHeight > 0 && el.offsetHeight < 200 &&
               el.offsetWidth > 50;
      });
      const hasToast = allFixed.length > 0;

      // Modaux : overlay grand format
      const modals = [...document.querySelectorAll('*')].filter(el => {
        const s = window.getComputedStyle(el);
        return s.position === 'fixed' &&
               el.offsetHeight > 200 && el.offsetWidth > 200 &&
               s.display !== 'none' && s.visibility !== 'hidden' &&
               (s.zIndex > 10 || el.style.zIndex > 10);
      });
      const hasModal = modals.length > 0;

      return [hasToast && 'toast', hasModal && 'modal/overlay'].filter(Boolean).join(', ');
    }).catch(() => '');

    const domAfter   = await page.evaluate(() => document.body.innerHTML.length).catch(() => domBefore);
    const domChanged = Math.abs(domAfter - domBefore) > 30;

    const erreurs = consoleErrors.join(' | ').slice(0, 220);

    const verdict = erreurs
      ? '🔴 erreur console'
      : !clicked
        ? '🔴 clic échoué'
        : (!toastModal && !domChanged)
          ? '⚠️ aucune réaction'
          : '✅ réaction';

    rows.push({
      label:     desc.label,
      clicked:   clicked ? 'oui' : `NON — ${clickNote}`,
      toastModal: toastModal || (domChanged ? 'DOM changé' : ''),
      erreurs,
      verdict,
    });

    await tryCloseModals();
    await page.waitForTimeout(300);
  }

  // ── 6. Écrire le rapport ──────────────────────────────────────
  const escMd = s => String(s || '').replace(/\|/g, '\\|');
  const tableLines = rows.map(r =>
    `| ${escMd(r.label)} | ${escMd(r.clicked)} | ${escMd(r.toastModal)} | ${escMd(r.erreurs)} | ${r.verdict} |`
  );

  const nb_ok     = rows.filter(r => r.verdict.startsWith('✅')).length;
  const nb_rouge  = rows.filter(r => r.verdict.startsWith('🔴')).length;
  const nb_warn   = rows.filter(r => r.verdict.startsWith('⚠️')).length;

  const rapport = [
    '# Rapport Robot Scan — Dashboard Patient',
    `Date : ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    `Compte : ${PHONE}`,
    '',
    '---',
    '',
    '## SECTION 1 — Erreurs au chargement',
    '',
    loadErrors.length
      ? '```\n' + loadErrors.join('\n') + '\n```'
      : '_Aucune erreur console détectée au chargement._',
    '',
    '---',
    '',
    '## SECTION 2 — Résultats bouton par bouton',
    '',
    '| data-testid / texte | a cliqué ? | toast/modal ? | erreur console ? | VERDICT |',
    '|---|---|---|---|---|',
    ...tableLines,
    '',
    '---',
    '',
    '## SECTION 3 — Récapitulatif',
    '',
    '| Verdict | Nombre |',
    '|---|---|',
    `| ✅ réaction (marche) | ${nb_ok} |`,
    `| 🔴 plante (erreur ou clic échoué) | ${nb_rouge} |`,
    `| ⚠️ aucune réaction / non visible | ${nb_warn} |`,
    `| **TOTAL** | **${rows.length}** |`,
    '',
  ].join('\n');

  fs.writeFileSync(REPORT_PATH, rapport, 'utf8');

  // ── 7. Affichage console ──────────────────────────────────────
  console.log('\n══════════════════════════════════════════════');
  console.log('RAPPORT :', REPORT_PATH);
  console.log('══════════════════════════════════════════════');
  console.log('\n── SECTION 1 — Erreurs au chargement ──');
  loadErrors.length ? loadErrors.forEach(e => console.log(' ', e)) : console.log('  (aucune)');
  console.log('\n── SECTION 3 — Récapitulatif ──');
  console.log(`  ✅ réaction     : ${nb_ok}`);
  console.log(`  🔴 plante       : ${nb_rouge}`);
  console.log(`  ⚠️ sans réaction : ${nb_warn}`);
  console.log(`  TOTAL           : ${rows.length}`);
  console.log('══════════════════════════════════════════════\n');
});
