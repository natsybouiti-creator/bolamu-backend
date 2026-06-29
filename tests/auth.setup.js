import { test as setup } from '@playwright/test';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const authFile = 'playwright/.auth/patient.json';

setup('authenticate', async () => {
  // Générer JWT directement sans passer par /auth/login (évite rate limiting)
  const token = jwt.sign(
    { phone: '+242069735418', role: 'patient' },
    process.env.JWT_SECRET,
    { expiresIn: '15min' }
  );

  // Stocker au format Playwright state avec localStorage
  const state = {
    origins: [{
      origin: 'https://api.bolamu.co',
      localStorage: [
        { name: 'bolamu_patient_token', value: token },
        { name: 'bolamu_patient_phone', value: '+242069735418' }
      ]
    }]
  };
  
  fs.writeFileSync(authFile, JSON.stringify(state));
});
