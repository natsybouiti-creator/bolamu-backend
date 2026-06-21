// Diagnostic TEMPORAIRE saveConst — a supprimer apres usage.
const { test } = require('@playwright/test');
const DASHBOARD = 'https://bolamu.co/patient/dashboard-v3-design.html';

test('debug const input', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto(DASHBOARD, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="nav-accueil"]');
  await page.waitForTimeout(5000);

  await page.locator('[data-testid="nav-suivre"]').first().click();
  await page.locator('[data-testid="btn-dossier-medical"]').first().click();
  await page.locator('[data-testid="const-edit"]').first().click();

  const input = page.locator('[data-testid="const-poids"]');
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.click();

  await page.keyboard.type('7');
  console.log('DBG apres "7":', JSON.stringify(await input.inputValue()));
  await page.waitForTimeout(40);
  await page.keyboard.type('0');
  console.log('DBG apres "0":', JSON.stringify(await input.inputValue()));
  console.log('DBG immediat:', JSON.stringify(await input.inputValue()));

  // Attend de franchir un tick du setInterval(now,1000) -> re-render global
  await page.waitForTimeout(1300);
  console.log('DBG apres tick now (1.3s):', JSON.stringify(await input.inputValue()));

  // L'input est-il recree a chaque render ? compare l'identite du noeud
  const same = await input.evaluate((el) => {
    window.__dbgNode = window.__dbgNode || el;
    return window.__dbgNode === el;
  });
  console.log('DBG meme noeud input qu\'avant ?', same);
});
