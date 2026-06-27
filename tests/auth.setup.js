import { test as setup } from '@playwright/test';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const authFile = 'playwright/.auth/patient.json';

setup('authenticate', async ({ page }) => {
  // Générer JWT directement sans passer par /auth/login (évite rate limiting)
  const token = jwt.sign(
    { phone: '+242069735418', role: 'patient' },
    process.env.JWT_SECRET,
    { expiresIn: '15min' }
  );

  // Injecter le token dans localStorage
  await page.addInitScript((accessToken) => {
    localStorage.setItem('bolamu_patient_token', accessToken);
    localStorage.setItem('bolamu_patient_phone', '+242069735418');
  }, token);

  // Sauvegarder l'état sans naviguer (évite timeout dashboard)
  await page.context().storageState({ path: authFile });
});
