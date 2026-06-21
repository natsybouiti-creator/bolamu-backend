import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/patient.json';

setup('authenticate', async ({ page, request }) => {
  const loginResponse = await request.post('https://bolamu.co/api/v1/auth/login', {
    data: { phone: '+242069735418', password: 'TestNouveau2026!' }
  });
  
  if (!loginResponse.ok()) {
    throw new Error(`Login failed: ${loginResponse.status()} ${await loginResponse.text()}`);
  }
  
  const { accessToken } = await loginResponse.json();
  
  // Injecter le token avant le chargement de la page
  await page.addInitScript((token) => {
    localStorage.setItem('bolamu_patient_token', token);
  }, accessToken);
  
  await page.goto('https://bolamu.co/patient/dashboard-v3-design.html');
  await page.waitForSelector('[data-testid="nav-accueil"]', { timeout: 15000 });
  
  // Sauvegarde l'état complet (localStorage + cookies) dans un fichier
  await page.context().storageState({ path: authFile });
});
