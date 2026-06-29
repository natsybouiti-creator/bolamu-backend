const { test, expect } = require('@playwright/test');

test('Vérification protocole window.__bolamu_test', async ({ page }) => {

  // Test register (page publique)
  await page.goto('https://www.bolamu.co/register.html');
  await page.waitForFunction(() => typeof window.__bolamu_test !== 'undefined', { timeout: 10000 });
  const register = await page.evaluate(() => typeof window.__bolamu_test);
  console.log('register.html:', register);

  // Test patient (page publique avec redirection si pas de token)
  await page.goto('https://www.bolamu.co/patient/dashboard.html');
  // Vérifier redirection vers login
  await page.waitForURL('**/patient/login.html', { timeout: 5000 });
  console.log('patient/dashboard: redirected to login (expected)');

  // Test agence (page protégée)
  await page.goto('https://www.bolamu.co/agence/dashboard.html');
  // Vérifier redirection vers login
  await page.waitForURL('**/agence/login.html', { timeout: 5000 });
  console.log('agence/dashboard: redirected to login (expected)');

  // Test admin (page protégée)
  await page.goto('https://www.bolamu.co/admin/dashboard.html');
  // Vérifier redirection vers login
  await page.waitForURL('**/admin/login.html', { timeout: 5000 });
  console.log('admin/dashboard: redirected to login (expected)');

});
