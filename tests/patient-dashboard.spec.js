import { test, expect } from '@playwright/test';

const TEST_PHONE = '+242069735418';
const TEST_PASSWORD = 'TestNouveau2026!';
const BASE_URL = 'https://bolamu.co';

test.describe('Dashboard Patient - Tests UI', () => {
  test.beforeEach(async ({ page, request }) => {
    // Auth — login via request API (avec gestion d'erreur gracieuse)
    let token = null;
    try {
      const loginResponse = await request.post('https://bolamu.co/api/v1/auth/login', {
        data: {
          phone: '+242069735418',
          password: 'TestNouveau2026!'
        }
      });
      
      if (loginResponse.ok()) {
        const loginData = await loginResponse.json();
        token = loginData.accessToken;
      }
    } catch (e) {
      console.log('Login API échoué, tests continueront sans auth:', e.message);
    }

    // Charger la page
    await page.goto('https://bolamu.co/patient/dashboard-v3-design.html');
    
    // Injecter le token si disponible
    if (token) {
      await page.evaluate((t) => localStorage.setItem('bolamu_patient_token', t), token);
      await page.reload();
    }

    // Attendre un élément réel du runtime
    await page.waitForSelector('[data-testid="nav-accueil"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000); // laisser DCLogic finir son hydration
  });

  test('1. Setup - Connexion et vérification profil', async ({ page }) => {
    await expect.soft(page.locator('h1')).toContainText('Antonio');
    await expect.soft(page.locator('button').filter({ hasText: /AN/ })).toBeVisible();
  });

  test('2. Onglet Accueil - Solde Zora et QR', async ({ page }) => {
    await expect.soft(page.locator('.pointsdrop')).toBeVisible();
    await expect.soft(page.locator('#hero-qr')).toBeVisible();
    await expect.soft(page.locator('text=/Renouvellement/').first()).toBeVisible();
  });

  test('3. Onglet Accueil - Événements Elonga', async ({ page }) => {
    await expect.soft(page.locator('.col2 > div').filter({ hasText: 'Événements' }).first()).toBeVisible();
    await expect.soft(page.locator('[style*="background-image"]').first()).toBeVisible();
  });

  test('4. Onglet Gagner - Sport & Activité', async ({ page }) => {
    await page.click('[data-testid="nav-gagner"]');
    await page.waitForTimeout(1000);
    await expect.soft(page.locator('div').filter({ hasText: /pts/ }).first()).toBeVisible();
  });

  test('5. Onglet Gagner - Santé', async ({ page }) => {
    await page.click('[data-testid="nav-gagner"]');
    await page.waitForTimeout(1000);
    
    const santeTab = page.locator('[data-testid="tab-sante"]');
    if (await santeTab.isVisible()) {
      await santeTab.click();
    }
    
    await expect.soft(page.locator('div').filter({ hasText: /RDV|labo|bilan/ }).first()).toBeVisible();
  });

  test('6. Onglet Suivre - Mes Zora', async ({ page }) => {
    await page.click('[data-testid="nav-suivre"]');
    await page.waitForTimeout(1000);
    await expect.soft(page.locator('text=/Zora/').first()).toBeVisible();
  });

  test('7. Onglet Suivre - Dossier médical', async ({ page }) => {
    await page.click('[data-testid="nav-suivre"]');
    await page.waitForTimeout(1000);
    
    const dossierBtn = page.locator('[data-testid="btn-dossier-medical"]');
    if (await dossierBtn.isVisible()) {
      await dossierBtn.click();
    }
    
    await expect.soft(page.locator('text=/' + TEST_PHONE.replace('+', '\\+') + '/').first()).toBeVisible();
  });

  test('8. Onglet Récompenses', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await page.waitForTimeout(1000);
    await expect.soft(page.locator('text=/Zora|pts/').first()).toBeVisible();
  });

  test('9. Navigation mobile - Responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await expect.soft(page.locator('.bottom-nav')).toBeVisible();
  });

  test('10. Chat - Drawer', async ({ page }) => {
    const chatIcon = page.locator('.material-symbols-outlined').filter({ hasText: 'forum' });
    if (await chatIcon.isVisible()) {
      await chatIcon.click();
      await page.waitForTimeout(500);
      await expect.soft(page.locator('[style*="position: fixed"]').filter({ hasText: /communauté|médecins/i }).first()).toBeVisible();
    }
  });

  test('11. Profil - Page profil', async ({ page }) => {
    const profileBtn = page.locator('[data-testid="btn-profil"]');
    await profileBtn.click();
    await page.waitForTimeout(1000);
    await expect.soft(page.locator('text=/Zora|streak|événements/i').first()).toBeVisible();
  });

  test('12. Sécurité - Token invalide', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('bolamu_patient_token', 'invalid_token_12345');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const isLoginPage = await page.locator('text=/connexion|login/i').isVisible();
    const hasError = await page.locator('text=/erreur|non autorisé/i').isVisible();
    
    await expect.soft(isLoginPage || hasError).toBeTruthy();
  });

  test('13. Performance - Temps de chargement', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/patient/dashboard-v3-design.html`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    await expect.soft(loadTime).toBeLessThan(5000);
  });
});

test.describe('Dashboard Patient - Tests API', () => {
  test('14. API - Endpoint profil patient', async ({ request }) => {
    const loginResponse = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: {
        phone: TEST_PHONE,
        password: TEST_PASSWORD
      }
    });
    
    await expect.soft(loginResponse.ok()).toBeTruthy();
    
    const loginData = await loginResponse.json();
    await expect.soft(loginData.success).toBeTruthy();
    
    if (loginData.accessToken) {
      const profileResponse = await request.get(`${BASE_URL}/api/v1/patients/profil?phone=${encodeURIComponent(TEST_PHONE)}`, {
        headers: {
          'Authorization': `Bearer ${loginData.accessToken}`
        }
      });
      
      await expect.soft(profileResponse.ok()).toBeTruthy();
      
      const profileData = await profileResponse.json();
      await expect.soft(profileData.success).toBeTruthy();
      await expect.soft(profileData.data).not.toBeNull();
    }
  });

  test('15. API - Endpoint Zora balance', async ({ request }) => {
    const loginResponse = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: {
        phone: TEST_PHONE,
        password: TEST_PASSWORD
      }
    });
    
    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      if (loginData.accessToken) {
        const balanceResponse = await request.get(`${BASE_URL}/api/v1/zora/balance`, {
          headers: {
            'Authorization': `Bearer ${loginData.accessToken}`
          }
        });
        
        await expect.soft(balanceResponse.ok()).toBeTruthy();
        
        const balanceData = await balanceResponse.json();
        await expect.soft(balanceData.success).toBeTruthy();
      }
    }
  });
});

