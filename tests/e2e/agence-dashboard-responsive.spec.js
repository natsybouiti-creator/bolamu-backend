const { test, expect } = require('@playwright/test');

test.describe('Agence Dashboard — Design System & Responsive', () => {
  test('Desktop 1280px — Police, Couleurs, Icônes, Navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('http://localhost:3005/agence/dashboard.html');
    
    // Vérifier police Plus Jakarta Sans
    const fontFamily = await page.evaluate(() => 
      window.getComputedStyle(document.body).fontFamily
    );
    expect(fontFamily).toContain('Plus Jakarta Sans');
    
    // Vérifier couleur navy
    const primaryColor = await page.evaluate(() => 
      window.getComputedStyle(document.documentElement).getPropertyValue('--bleu')
    );
    expect(primaryColor).toBe('#0A2463');
    
    // Vérifier couleur turquoise
    const turquoiseColor = await page.evaluate(() => 
      window.getComputedStyle(document.documentElement).getPropertyValue('--vert')
    );
    expect(turquoiseColor).toBe('#00C9A7');
    
    // Vérifier Material Symbols Outlined chargés
    const materialSymbolsLoaded = await page.evaluate(() => 
      document.querySelector('link[href*="Material+Symbols+Outlined"]') !== null
    );
    expect(materialSymbolsLoaded).toBe(true);
    
    // Vérifier sidebar visible sur desktop
    const sidebarVisible = await page.locator('.sidebar').isVisible();
    expect(sidebarVisible).toBe(true);
    
    // Vérifier bottom-nav masqué sur desktop
    const bottomNavVisible = await page.locator('.bottom-nav').isVisible();
    expect(bottomNavVisible).toBe(false);
    
    // Vérifier icônes Material Symbols dans sidebar
    const materialSymbolsCount = await page.locator('.sidebar .material-symbols-outlined').count();
    expect(materialSymbolsCount).toBeGreaterThan(0);
    
    // Screenshot desktop
    await page.screenshot({ path: 'test-results/agence-desktop-1280px.png', fullPage: true });
  });

  test('Mobile 390px — Police, Couleurs, Icônes, Navigation', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3005/agence/dashboard.html');
    
    // Vérifier police Plus Jakarta Sans
    const fontFamily = await page.evaluate(() => 
      window.getComputedStyle(document.body).fontFamily
    );
    expect(fontFamily).toContain('Plus Jakarta Sans');
    
    // Vérifier sidebar masqué sur mobile
    const sidebarVisible = await page.locator('.sidebar').isVisible();
    expect(sidebarVisible).toBe(false);
    
    // Vérifier bottom-nav visible sur mobile
    const bottomNavVisible = await page.locator('.bottom-nav').isVisible();
    expect(bottomNavVisible).toBe(true);
    
    // Vérifier icônes Material Symbols dans bottom-nav
    const materialSymbolsCount = await page.locator('.bottom-nav .material-symbols-outlined').count();
    expect(materialSymbolsCount).toBeGreaterThan(0);
    
    // Screenshot mobile
    await page.screenshot({ path: 'test-results/agence-mobile-390px.png', fullPage: true });
  });
});
