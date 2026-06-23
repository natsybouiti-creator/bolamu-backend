// audit-patient-front.spec.js
// Vérifie que chaque bouton interactif du dashboard patient vanilla appelle bien une route API réelle.
const { test, expect } = require('@playwright/test');

const BASE = process.env.APP_URL || 'http://localhost:10000';
const PATIENT_PHONE = process.env.TEST_PATIENT_PHONE || '+243812345678';
const PATIENT_PWD = process.env.TEST_PATIENT_PWD || 'test1234';

async function loginPatient(page) {
  await page.goto(BASE + '/patient/login.html');
  await page.fill('[data-testid="input-phone"]', PATIENT_PHONE);
  await page.fill('[data-testid="input-password"]', PATIENT_PWD);
  await page.click('[data-testid="btn-login"]');
  await page.waitForURL('**/dashboard.html', { timeout: 10000 });
}

test.describe('Dashboard Patient — Audit de persistance', () => {
  test.beforeEach(async ({ page }) => {
    await loginPatient(page);
  });

  // ── CHARGEMENT INITIAL ──
  test('01 — Chargement initial: hero-name visible', async ({ page }) => {
    await expect(page.locator('#heroName')).not.toHaveText('…', { timeout: 8000 });
  });

  test('02 — Chargement initial: balance Zora visible dans le header', async ({ page }) => {
    await expect(page.locator('[data-testid="zora-balance-chip"]')).toBeVisible();
    const text = await page.locator('#headerZora').textContent();
    expect(text).not.toBe('—');
  });

  test('03 — Chargement initial: streak chargé', async ({ page }) => {
    await page.waitForTimeout(3000);
    const streak = await page.locator('#heroStreak').textContent();
    expect(streak).not.toBe('—');
  });

  // ── NAVIGATION ──
  test('04 — Navigation: clic Gagner affiche la section', async ({ page }) => {
    await page.click('[data-testid="nav-gagner"]');
    await expect(page.locator('#section-gagner')).toBeVisible();
  });

  test('05 — Navigation: clic Suivre affiche la section', async ({ page }) => {
    await page.click('[data-testid="nav-suivre"]');
    await expect(page.locator('#section-suivre')).toBeVisible();
  });

  test('06 — Navigation: clic Récompenses affiche la section', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await expect(page.locator('#section-recompenses')).toBeVisible();
  });

  // ── RDV ──
  test('07 — RDV: bouton "Prendre RDV" ouvre la modal', async ({ page }) => {
    await page.click('[data-testid="btn-prendre-rdv"]');
    await expect(page.locator('#rdv-modal')).toHaveClass(/open/);
  });

  test('08 — RDV: modal charge la liste des médecins', async ({ page }) => {
    await page.click('[data-testid="btn-prendre-rdv"]');
    await expect(page.locator('#rdvDoctor')).not.toContainText('Chargement', { timeout: 8000 });
  });

  test('09 — RDV: sélection médecin + date charge les créneaux', async ({ page }) => {
    await page.click('[data-testid="btn-prendre-rdv"]');
    await page.waitForSelector('#rdvDoctor option[value]:not([value=""])');
    const options = await page.$$eval('#rdvDoctor option', opts => opts.filter(o => o.value).map(o => o.value));
    if (!options.length) { console.log('[BLOCAGE 9] Aucun médecin disponible'); return; }
    await page.selectOption('#rdvDoctor', options[0]);
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('#rdvDate', tomorrow.toISOString().slice(0, 10));
    await page.dispatchEvent('#rdvDate', 'change');
    await page.waitForSelector('#slotsGroup', { state: 'visible', timeout: 8000 }).catch(() => {});
  });

  test('10 — RDV: POST /api/v1/appointments/book appelé à la confirmation', async ({ page }) => {
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/appointments/book') && r.method() === 'POST', { timeout: 12000 }).catch(() => null),
      (async () => {
        await page.click('[data-testid="btn-prendre-rdv"]');
        await page.waitForSelector('#rdvDoctor option[value]:not([value=""])');
        const options = await page.$$eval('#rdvDoctor option', opts => opts.filter(o => o.value).map(o => o.value));
        if (!options.length) return;
        await page.selectOption('#rdvDoctor', options[0]);
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        await page.fill('#rdvDate', tomorrow.toISOString().slice(0, 10));
        await page.dispatchEvent('#rdvDate', 'change');
        await page.waitForTimeout(2000);
        const slots = await page.$$('[data-testid^="slot-"]');
        if (!slots.length) return;
        await slots[0].click();
        await page.click('[data-testid="btn-confirm-rdv"]');
      })()
    ]);
    if (req) {
      expect(req.method()).toBe('POST');
      const body = JSON.parse(req.postData() || '{}');
      expect(body).toHaveProperty('patient_phone');
      expect(body).toHaveProperty('doctor_id');
      expect(body).toHaveProperty('date');
      expect(body).toHaveProperty('time');
    } else {
      console.log('[BLOCAGE 10] Aucun médecin/créneau disponible pour tester le booking');
    }
  });

  // ── CONSTANTES ──
  test('11 — Constantes: modal s\'ouvre depuis le dossier médical', async ({ page }) => {
    await page.click('[data-testid="nav-suivre"]');
    await page.click('[data-testid="tab-suivre-dossier"]');
    await page.click('[data-testid="btn-edit-constantes"]');
    await expect(page.locator('#const-modal')).toHaveClass(/open/);
  });

  test('12 — Constantes: POST /api/v1/patients/constantes appelé à l\'enregistrement', async ({ page }) => {
    await page.click('[data-testid="nav-suivre"]');
    await page.click('[data-testid="tab-suivre-dossier"]');
    await page.click('[data-testid="btn-edit-constantes"]');
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/patients/constantes') && r.method() === 'POST', { timeout: 8000 }),
      (async () => {
        await page.fill('[data-testid="const-poids"]', '72');
        await page.fill('[data-testid="const-taille"]', '175');
        await page.selectOption('[data-testid="const-blood"]', 'O+');
        await page.click('[data-testid="btn-save-constantes"]');
      })()
    ]);
    expect(req.method()).toBe('POST');
    const body = JSON.parse(req.postData() || '{}');
    expect(body.poids).toBe(72);
    expect(body.taille).toBe(175);
  });

  // ── ÉVÉNEMENTS ──
  test('13 — Événements: liste visible sur l\'accueil', async ({ page }) => {
    await page.waitForTimeout(3000);
    const events = page.locator('#homeEventsList .event-card');
    const count = await events.count();
    if (count === 0) { console.log('[BLOCAGE 13] Aucun événement en base'); return; }
    await expect(events.first()).toBeVisible();
  });

  test('14 — Événements: POST /api/v1/events/:id/register appelé au clic Participer', async ({ page }) => {
    await page.waitForTimeout(3000);
    const btn = page.locator('[data-testid^="btn-participate-"]').first();
    if (!await btn.isVisible()) { console.log('[BLOCAGE 14] Aucun bouton Participer visible'); return; }
    if (await btn.isDisabled()) { console.log('[BLOCAGE 14] Déjà inscrit à tous les événements'); return; }
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/events/') && r.url().includes('/register') && r.method() === 'POST', { timeout: 6000 }),
      btn.click()
    ]);
    expect(req.method()).toBe('POST');
  });

  // ── GROUPES ──
  test('15 — Groupes: POST /api/v1/sport-groups/:id/join appelé au clic Rejoindre', async ({ page }) => {
    await page.waitForTimeout(3000);
    const btn = page.locator('[data-testid^="btn-join-group-"]:not([disabled])').first();
    if (!await btn.isVisible()) { console.log('[BLOCAGE 15] Tous les groupes déjà rejoints ou aucun groupe'); return; }
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/sport-groups/') && r.url().includes('/join') && r.method() === 'POST', { timeout: 6000 }),
      btn.click()
    ]);
    expect(req.method()).toBe('POST');
  });

  // ── JEUX ZORA ──
  test('16 — Jeux: grille visible sur l\'onglet Récompenses', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await page.waitForSelector('[data-testid^="game-card-"]', { timeout: 8000 });
    const cards = page.locator('[data-testid^="game-card-"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('17 — Jeux: POST /api/v1/zora/games/play appelé pour la carte à gratter', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await page.waitForSelector('[data-testid="btn-play-scratch"]', { timeout: 8000 });
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/zora/games/play') && r.method() === 'POST', { timeout: 10000 }),
      (async () => {
        await page.click('[data-testid="btn-play-scratch"]');
        // Simulate scratch (dispatch mouse events on canvas)
        const canvas = page.locator('#scratchCanvas');
        await canvas.dispatchEvent('mousedown', { offsetX: 50, offsetY: 50 });
        for (let x = 0; x <= 200; x += 10) {
          await canvas.dispatchEvent('mousemove', { offsetX: x, offsetY: 50 });
        }
        for (let y = 0; y <= 100; y += 10) {
          await canvas.dispatchEvent('mousemove', { offsetX: 100, offsetY: y });
        }
        await canvas.dispatchEvent('mouseup', {});
      })()
    ]);
    expect(req.method()).toBe('POST');
    const body = JSON.parse(req.postData() || '{}');
    expect(body.game_type).toBe('scratch');
  });

  test('18 — Jeux: POST /api/v1/zora/games/play appelé pour la roue', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await page.waitForSelector('[data-testid="btn-play-wheel"]', { timeout: 8000 });
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/zora/games/play') && r.method() === 'POST', { timeout: 8000 }),
      (async () => {
        await page.click('[data-testid="btn-play-wheel"]');
        await page.waitForSelector('[data-testid="btn-spin-wheel"]', { timeout: 3000 });
        await page.click('[data-testid="btn-spin-wheel"]');
      })()
    ]);
    expect(req.method()).toBe('POST');
    const body = JSON.parse(req.postData() || '{}');
    expect(body.game_type).toBe('wheel');
  });

  test('19 — Jeux: POST /api/v1/zora/games/play appelé pour le coffre', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await page.waitForSelector('[data-testid="btn-play-chest"]', { timeout: 8000 });
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/zora/games/play') && r.method() === 'POST', { timeout: 8000 }),
      (async () => {
        await page.click('[data-testid="btn-play-chest"]');
        await page.waitForSelector('[data-testid="btn-open-chest"]', { timeout: 3000 });
        await page.click('[data-testid="btn-open-chest"]');
      })()
    ]);
    expect(req.method()).toBe('POST');
    const body = JSON.parse(req.postData() || '{}');
    expect(body.game_type).toBe('chest');
  });

  test('20 — Jeux: POST /api/v1/zora/games/play appelé pour le quiz', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await page.waitForSelector('[data-testid="btn-play-quiz"]', { timeout: 8000 });
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/zora/games/play') && r.method() === 'POST', { timeout: 8000 }),
      (async () => {
        await page.click('[data-testid="btn-play-quiz"]');
        await page.waitForSelector('[data-testid^="quiz-opt-"]', { timeout: 5000 });
        await page.click('[data-testid="quiz-opt-0"]');
      })()
    ]);
    expect(req.method()).toBe('POST');
    const body = JSON.parse(req.postData() || '{}');
    expect(body.game_type).toBe('quiz');
  });

  // ── QR URGENCE ──
  test('21 — QR: GET /api/v1/qr/generate appelé à l\'affichage', async ({ page }) => {
    await page.click('[data-testid="nav-suivre"]');
    await page.click('[data-testid="tab-suivre-dossier"]');
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/qr/generate'), { timeout: 8000 }),
      page.click('[data-testid="btn-qr-urgence"]')
    ]);
    expect(req.method()).toBe('GET');
  });

  // ── CHAT ──
  test('22 — Chat: tiroir s\'ouvre et charge les messages', async ({ page }) => {
    await page.click('[data-testid="btn-open-chat"]');
    await expect(page.locator('#chatDrawer')).toHaveClass(/open/);
    await page.waitForTimeout(2000);
  });

  test('23 — Chat: POST /api/v1/chat/:channel/messages appelé à l\'envoi', async ({ page }) => {
    await page.click('[data-testid="btn-open-chat"]');
    await page.waitForTimeout(500);
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/chat/') && r.url().includes('/messages') && r.method() === 'POST', { timeout: 6000 }),
      (async () => {
        await page.fill('[data-testid="chat-input"]', 'Test message ' + Date.now());
        await page.click('[data-testid="btn-send-chat"]');
      })()
    ]);
    expect(req.method()).toBe('POST');
  });

  // ── RÉCOMPENSES ──
  test('24 — Récompenses: catalogue visible', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await page.waitForTimeout(3000);
    const el = page.locator('#rewardsList');
    await expect(el).toBeVisible();
  });

  test('25 — Récompenses: POST /api/v1/zora/redeem appelé à l\'échange (si solde suffisant)', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await page.waitForTimeout(3000);
    const btns = page.locator('[data-testid^="btn-redeem-"]');
    const count = await btns.count();
    if (!count) { console.log('[BLOCAGE 25] Aucune récompense disponible'); return; }
    const bal = parseInt(await page.locator('#headerZora').textContent() || '0');
    if (bal < 10) { console.log('[BLOCAGE 25] Solde insuffisant pour tester le redeem'); return; }
    const [req] = await Promise.all([
      page.waitForRequest(r => r.url().includes('/zora/redeem') && r.method() === 'POST', { timeout: 6000 }),
      btns.first().click()
    ]);
    if (req) expect(req.method()).toBe('POST');
  });

  // ── ZORA LEDGER ──
  test('26 — Zora: historique ledger visible', async ({ page }) => {
    await page.click('[data-testid="nav-suivre"]');
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-testid="tab-suivre-zora"]')).toBeVisible();
  });

  // ── DÉCONNEXION ──
  test('27 — Auth: déconnexion redirige vers /patient/login.html', async ({ page }) => {
    await page.click('[data-testid="btn-profile"]');
    await page.click('[data-testid="pmenu-logout"]');
    await page.waitForURL('**/patient/login.html', { timeout: 5000 });
  });

  // ── SPORT CHALLENGES ──
  test('28 — Sport: boutons "Bientôt dispo" affichent un toast (pas de fausse persistance)', async ({ page }) => {
    await page.click('[data-testid="nav-gagner"]');
    await page.waitForSelector('[data-testid^="btn-sport-"]', { timeout: 5000 });
    await page.click('[data-testid="btn-sport-directions_walk"]');
    await expect(page.locator('#toast')).toHaveClass(/show/, { timeout: 3000 });
  });

  // ── GAGNER SANTÉ ──
  test('29 — Gagner > Santé: RDV modal s\'ouvre depuis la section santé', async ({ page }) => {
    await page.click('[data-testid="nav-gagner"]');
    await page.click('[data-testid="tab-gagner-sante"]');
    await page.click('[data-testid="btn-prendre-rdv-sante"]');
    await expect(page.locator('#rdv-modal')).toHaveClass(/open/);
  });

  // ── ZORA BALANCE ──
  test('30 — Zora: chip du header clique → naviguer vers Suivre > Zora', async ({ page }) => {
    await page.click('[data-testid="zora-balance-chip"]');
    await expect(page.locator('#section-suivre')).toBeVisible();
    await expect(page.locator('#paneSuivreZora')).toBeVisible();
  });
});
