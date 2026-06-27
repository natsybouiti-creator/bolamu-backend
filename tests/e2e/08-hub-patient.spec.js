// ============================================================
// BOLAMU — HUB PATIENT : 5 tests simples
// Playwright request API (pas fetch natif)
// ============================================================
import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.TEST_API_BASE || 'http://localhost:3005';
const PATIENT_PHONE = '+242069735418';

function generateToken(phone, role) {
  return jwt.sign(
    { phone, role },
    process.env.JWT_SECRET,
    { expiresIn: '15min' }
  );
}

test.describe('Hub Patient — Sprint 5', () => {
  let patientToken;

  test.beforeAll(async () => {
    patientToken = generateToken(PATIENT_PHONE, 'patient');
  });

  test('H1: GET /patients/profil — profil patient', async ({ request }) => {
    const response = await request.get(
      `${BASE}/api/v1/patients/profil?phone=${encodeURIComponent(PATIENT_PHONE)}`,
      { headers: { 'Authorization': `Bearer ${patientToken}` } }
    );
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('phone');
  });

  test('H2: GET /zora/balance — solde Zora', async ({ request }) => {
    const response = await request.get(`${BASE}/api/v1/zora/balance`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('balance');
  });

  test('H3: GET /clubs — liste clubs disponibles', async ({ request }) => {
    const response = await request.get(`${BASE}/api/v1/clubs`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.clubs)).toBe(true);
  });

  test('H4: GET /chat/conversations/1/messages — messages communauté', async ({ request }) => {
    const response = await request.get(
      `${BASE}/api/v1/chat/conversations/1/messages`,
      { headers: { 'Authorization': `Bearer ${patientToken}` } }
    );
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('H5: GET /events — liste événements', async ({ request }) => {
    const response = await request.get(`${BASE}/api/v1/events`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
