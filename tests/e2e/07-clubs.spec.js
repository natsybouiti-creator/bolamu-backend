const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const API = process.env.API_URL ? `${process.env.API_URL}/api/v1` : 'https://api.bolamu.co/api/v1';

// Configuration auth
const PATIENT_PHONE = '+242069735418';

// Génération directe de token JWT pour éviter rate limiting
function generateToken(phone, role) {
  return jwt.sign(
    { phone, role },
    process.env.JWT_SECRET,
    { expiresIn: '15min' }
  );
}

test.describe('Clubs — Sprint 5', () => {
  let patientToken;
  let testClubId;

  test.beforeAll(async () => {
    // Génération directe de token JWT
    patientToken = generateToken(PATIENT_PHONE, 'patient');
  });

  test('C1: GET /clubs — liste clubs', async () => {
    const response = await fetch(`${API}/clubs`, {
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.clubs)).toBe(true);
  });

  test('C2: POST /clubs — créer club', async () => {
    const response = await fetch(`${API}/clubs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Club Playwright Test',
        description: 'Club pour tests Playwright',
        category: 'Sport'
      })
    });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBeDefined();
    testClubId = data.data.id;
  });

  test('C3: POST /clubs/:id/join — rejoindre club', async () => {
    const response = await fetch(`${API}/clubs/${testClubId}/join`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Club rejoint avec succès');
  });

  test('C4: GET /clubs/:id/members — voir membres', async () => {
    const response = await fetch(`${API}/clubs/${testClubId}/members`, {
      headers: {
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThan(0);
  });

  test('C5: DELETE /clubs/:id/join — quitter club', async () => {
    const response = await fetch(`${API}/clubs/${testClubId}/join`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Club quitté avec succès');
  });

  test.afterAll(async () => {
    // Nettoyage
    const pool = require('../../src/config/db');
    await pool.query(`DELETE FROM club_members WHERE club_id = $1`, [testClubId]);
    await pool.query(`DELETE FROM clubs WHERE id = $1`, [testClubId]);
    await pool.end();
  });
});
