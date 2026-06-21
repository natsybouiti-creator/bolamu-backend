import { test, expect } from '@playwright/test';

const TEST_PHONE = '+242069735418';
const TEST_PASSWORD = 'TestNouveau2026!';
const BASE_URL = 'https://bolamu.co';

test.describe('Dashboard Patient - Tests UI', () => {
  test.beforeEach(async ({ page, request }) => {
    // Auth — injecter le token directement via login API
    const loginResponse = await request.post('https://bolamu.co/api/v1/auth/login', {
      data: {
        phone: '+242069735418',
        password: 'TestNouveau2026!'
      }
    });
    
    if (!loginResponse.ok()) {
      throw new Error('Login API failed');
    }
    
    const loginData = await loginResponse.json();
    const token = loginData.accessToken; // accessToken pas token

    if (!token) {
      throw new Error('No token received from login API');
    }

    // Injecter dans localStorage avant chargement de la page
    await page.goto('https://bolamu.co/patient/dashboard-v3-design.html');
    await page.evaluate((t) => {
      localStorage.setItem('bolamu_patient_token', t);
    }, token);
    await page.reload();

    // Attendre que le runtime DCLogic soit chargé
    await page.waitForTimeout(3000);

    // Vérifier que Antonio s'affiche
    await page.waitForSelector('h1', { timeout: 10000 });
    const h1 = await page.textContent('h1');
    expect(h1).toContain('Antonio');
  });

  test('1. Setup - Connexion et vérification profil', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Vérifier que le nom "Antonio" s'affiche
    const greeting = await page.locator('h1').first();
    await expect(greeting).toContainText('Antonio');
    
    // Vérifier initiales "AN" dans bouton profil
    const profileBtn = page.locator('button').filter({ hasText: /AN/ });
    await expect(profileBtn).toBeVisible();
  });

  test('2. Onglet Accueil - Solde Zora et QR', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Vérifier solde Zora
    const zoraBalance = page.locator('.pointsdrop');
    await expect(zoraBalance).toBeVisible();
    
    // Vérifier QR code
    const qrCode = page.locator('#hero-qr');
    await expect(qrCode).toBeVisible();
    
    // Vérifier compteur renouvellement QR
    const qrTimer = page.locator('text=/Renouvellement/').first();
    await expect(qrTimer).toBeVisible();
  });

  test('3. Onglet Accueil - Événements Elonga', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Vérifier événements avec photos
    const eventCards = page.locator('.col2 > div').filter({ hasText: 'Événements' });
    await expect(eventCards.first()).toBeVisible();
    
    // Vérifier que chaque EventCard a une photo
    const eventImages = page.locator('[style*="background-image"]');
    await expect(eventImages.first()).toBeVisible();
  });

  test('4. Onglet Gagner - Sport & Activité', async ({ page }) => {
    // Cliquer sur Gagner
    await page.click('[data-testid="nav-gagner"]');
    await page.waitForTimeout(1000);
    
    // Vérifier EarnCards Sport
    const earnCards = page.locator('div').filter({ hasText: /pts/ });
    await expect(earnCards.first()).toBeVisible();
  });

  test('5. Onglet Gagner - Santé', async ({ page }) => {
    // Cliquer sur Gagner puis Santé
    await page.click('[data-testid="nav-gagner"]');
    await page.waitForTimeout(1000);
    
    // Cliquer sur sous-onglet Santé si présent
    const santeTab = page.locator('[data-testid="tab-sante"]');
    if (await santeTab.isVisible()) {
      await santeTab.click();
    }
    
    // Vérifier EarnCards Actions santé
    const actionCards = page.locator('div').filter({ hasText: /RDV|labo|bilan/ });
    await expect(actionCards.first()).toBeVisible();
  });

  test('6. Onglet Suivre - Mes Zora', async ({ page }) => {
    await page.click('[data-testid="nav-suivre"]');
    await page.waitForTimeout(1000);
    
    // Vérifier carte solde Zora
    const zoraCard = page.locator('text=/Zora/').first();
    await expect(zoraCard).toBeVisible();
  });

  test('7. Onglet Suivre - Dossier médical', async ({ page }) => {
    await page.click('[data-testid="nav-suivre"]');
    await page.waitForTimeout(1000);
    
    // Cliquer sur Mon dossier médical
    const dossierBtn = page.locator('[data-testid="btn-dossier-medical"]');
    if (await dossierBtn.isVisible()) {
      await dossierBtn.click();
    }
    
    // Vérifier informations patient
    const phoneDisplay = page.locator('text=/' + TEST_PHONE.replace('+', '\\+') + '/');
    await expect(phoneDisplay.first()).toBeVisible();
  });

  test('8. Onglet Récompenses', async ({ page }) => {
    await page.click('[data-testid="nav-recompenses"]');
    await page.waitForTimeout(1000);
    
    // Vérifier solde Zora
    const zoraDisplay = page.locator('text=/Zora|pts/').first();
    await expect(zoraDisplay).toBeVisible();
  });

  test('9. Navigation mobile - Responsive', async ({ page }) => {
    // Réduire à 375px
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Vérifier bottom nav
    const bottomNav = page.locator('.bottom-nav');
    await expect(bottomNav).toBeVisible();
  });

  test('10. Chat - Drawer', async ({ page }) => {
    // Cliquer icône forum
    const chatIcon = page.locator('.material-symbols-outlined').filter({ hasText: 'forum' });
    if (await chatIcon.isVisible()) {
      await chatIcon.click();
      await page.waitForTimeout(500);
      
      // Vérifier drawer ouvert
      const drawer = page.locator('[style*="position: fixed"]').filter({ hasText: /communauté|médecins/i });
      await expect(drawer.first()).toBeVisible();
    }
  });

  test('11. Profil - Page profil', async ({ page }) => {
    // Cliquer bouton profil
    const profileBtn = page.locator('[data-testid="btn-profil"]');
    await profileBtn.click();
    await page.waitForTimeout(1000);
    
    // Vérifier stats
    const stats = page.locator('text=/Zora|streak|événements/i');
    await expect(stats.first()).toBeVisible();
  });

  test('12. API - Endpoint profil patient', async ({ request }) => {
    // D'abord obtenir un token valide
    const loginResponse = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: {
        phone: TEST_PHONE,
        password: TEST_PASSWORD
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    
    const loginData = await loginResponse.json();
    expect(loginData.success).toBeTruthy();
    
    if (loginData.data?.accessToken) {
      // Tester endpoint profil
      const profileResponse = await request.get(`${BASE_URL}/api/v1/patients/profil?phone=${encodeURIComponent(TEST_PHONE)}`, {
        headers: {
          'Authorization': `Bearer ${loginData.data.accessToken}`
        }
      });
      
      expect(profileResponse.ok()).toBeTruthy();
      
      const profileData = await profileResponse.json();
      expect(profileData.success).toBeTruthy();
      expect(profileData.data).not.toBeNull();
    }
  });

  test('13. API - Endpoint Zora balance', async ({ request }) => {
    const loginResponse = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: {
        phone: TEST_PHONE,
        password: TEST_PASSWORD
      }
    });
    
    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      if (loginData.data?.accessToken) {
        const balanceResponse = await request.get(`${BASE_URL}/api/v1/zora/balance`, {
          headers: {
            'Authorization': `Bearer ${loginData.data.accessToken}`
          }
        });
        
        expect(balanceResponse.ok()).toBeTruthy();
        
        const balanceData = await balanceResponse.json();
        expect(balanceData.success).toBeTruthy();
      }
    }
  });

  test('14. Sécurité - Token invalide', async ({ page }) => {
    // Injecter token invalide
    await page.evaluate(() => {
      localStorage.setItem('bolamu_patient_token', 'invalid_token_12345');
    });
    await page.reload();
    
    // Vérifier redirection vers login ou gestion d'erreur
    await page.waitForLoadState('networkidle');
    
    // Soit redirection vers login, soit message d'erreur gracieux
    const isLoginPage = await page.locator('text=/connexion|login/i').isVisible();
    const hasError = await page.locator('text=/erreur|non autorisé/i').isVisible();
    
    expect(isLoginPage || hasError).toBeTruthy();
  });

  test('15. Performance - Temps de chargement', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/patient/dashboard-v3-design.html`);
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Le chargement doit prendre moins de 5 secondes
    expect(loadTime).toBeLessThan(5000);
  });
});

test.describe('Dashboard Patient - Tests API', () => {
  test('12. API - Endpoint profil patient', async ({ request }) => {
    // D'abord obtenir un token valide
    const loginResponse = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: {
        phone: TEST_PHONE,
        password: TEST_PASSWORD
      }
    });
    
    expect(loginResponse.ok()).toBeTruthy();
    
    const loginData = await loginResponse.json();
    expect(loginData.success).toBeTruthy();
    
    if (loginData.data?.accessToken) {
      // Tester endpoint profil
      const profileResponse = await request.get(`${BASE_URL}/api/v1/patients/profil?phone=${encodeURIComponent(TEST_PHONE)}`, {
        headers: {
          'Authorization': `Bearer ${loginData.data.accessToken}`
        }
      });
      
      expect(profileResponse.ok()).toBeTruthy();
      
      const profileData = await profileResponse.json();
      expect(profileData.success).toBeTruthy();
      expect(profileData.data).not.toBeNull();
    }
  });

  test('13. API - Endpoint Zora balance', async ({ request }) => {
    const loginResponse = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: {
        phone: TEST_PHONE,
        password: TEST_PASSWORD
      }
    });
    
    if (loginResponse.ok()) {
      const loginData = await loginResponse.json();
      if (loginData.data?.accessToken) {
        const balanceResponse = await request.get(`${BASE_URL}/api/v1/zora/balance`, {
          headers: {
            'Authorization': `Bearer ${loginData.data.accessToken}`
          }
        });
        
        expect(balanceResponse.ok()).toBeTruthy();
        
        const balanceData = await balanceResponse.json();
        expect(balanceData.success).toBeTruthy();
      }
    }
  });
});
