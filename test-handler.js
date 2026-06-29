const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('🔵 Navigation vers login...');
    await page.goto('https://www.bolamu.co/login.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    console.log('🔵 Connexion...');
    await page.waitForSelector('#phone-input', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#password-input', { state: 'visible', timeout: 10000 });
    await page.fill('#phone-input', '+242069735418');
    await page.fill('#password-input', 'TestNouveau2026!');
    await page.waitForTimeout(1000);
    await page.click('#btn-login', { force: true });
    
    console.log('🔵 Attente redirection...');
    try {
      await page.waitForURL('**/patient/dashboard.html', { timeout: 10000 });
    } catch (e) {
      console.log('⚠️ Navigation manuelle...');
      await page.goto('https://www.bolamu.co/patient/dashboard.html', { waitUntil: 'domcontentloaded' });
    }
    
    console.log('🔵 Attente 8s pour DCLogic...');
    await page.waitForTimeout(8000);
    
    console.log('🔍 Test appel direct goGagner...');
    const result = await page.evaluate(() => {
      // Vérifier si goGagner est accessible
      const navGagner = document.querySelector('[data-testid="nav-gagner"]');
      const onclickAttr = navGagner?.getAttribute('onclick');
      
      // Tenter d'appeler le handler via l'attribut onclick
      let handlerResult = 'N/A';
      try {
        if (onclickAttr && onclickAttr.includes('goGagner')) {
          // Le handler est dans le template, mais on ne peut pas l'appeler directement
          handlerResult = 'Handler dans template DCLogic (non accessible directement)';
        }
      } catch (e) {
        handlerResult = 'Erreur: ' + e.message;
      }
      
      return {
        nav_gagner_exists: !!navGagner,
        onclick_attribute: onclickAttr,
        handler_result: handlerResult,
        dc_logic_ready: typeof window.DCLogic !== 'undefined',
        current_panel: window.__state?.panel || 'N/A'
      };
    });
    
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Erreur:', error.message);
  } finally {
    await browser.close();
  }
})();
