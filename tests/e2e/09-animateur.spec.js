import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const BASE = process.env.TEST_API_BASE || 'http://localhost:3005';
const ANIMATEUR_PHONE = '+242000000088';

function generateToken(phone, role) {
  return jwt.sign(
    { phone, role },
    process.env.JWT_SECRET,
    { expiresIn: '15min' }
  );
}

test.describe('Animateur — Sprint 3', () => {
  let animateurToken;
  let eventId;

  test.beforeAll(async () => {
    animateurToken = generateToken(ANIMATEUR_PHONE, 'animateur');
  });

  test('AN-1: GET /animateur/events → liste événements animateur', async ({ request }) => {
    const response = await request.get(
      `${BASE}/api/v1/animateur/events?limit=50`,
      { headers: { 'Authorization': `Bearer ${animateurToken}` } }
    );
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('AN-2: POST /animateur/events → créer événement', async ({ request }) => {
    const response = await request.post(`${BASE}/api/v1/animateur/events`, {
      headers: {
        'Authorization': `Bearer ${animateurToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        title: 'Test Événement Playwright',
        pillar: 'sport',
        city: 'Brazzaville',
        location_name: 'Stade Test',
        location_address: 'Avenue Test',
        starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
        ends_at: new Date(Date.now() + 90000000).toISOString().slice(0, 16),
        max_participants: 50,
        zora_reward: 50,
        description: 'Événement de test Playwright'
      }
    });
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    // Format réel : {success: true, event_id: ...}
    expect(data).toHaveProperty('event_id');
    eventId = data.event_id;
  });

  test('AN-3: PATCH /events/:id/activate → status=active', async ({ request }) => {
    if (!eventId) {
      const createRes = await request.post(`${BASE}/api/v1/animateur/events`, {
        headers: {
          'Authorization': `Bearer ${animateurToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          title: 'Test Fallback Playwright',
          pillar: 'sport',
          city: 'Brazzaville',
          location_name: 'Stade Test',
          location_address: 'Avenue Test',
          starts_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
          ends_at: new Date(Date.now() + 90000000).toISOString().slice(0, 16),
          max_participants: 50,
          zora_reward: 50,
          description: 'Fallback test'
        }
      });
      const createData = await createRes.json();
      eventId = createData.event_id;
    }

    const response = await request.patch(
      `${BASE}/api/v1/events/${eventId}/activate`,
      { headers: { 'Authorization': `Bearer ${animateurToken}` } }
    );
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('AN-4: GET /events/:id/checkin-token → UUID retourné (SKIP: route patient, pas animateur)', async ({ request }) => {
    test.skip();
    // Cette route est destinée aux patients inscrits, pas aux animateurs
    // L'animateur scanne les tokens générés par les patients
  });

  test('AN-5: PATCH /events/:id/complete → status=completed', async ({ request }) => {
    if (!eventId) { test.skip(); return; }
    const response = await request.patch(
      `${BASE}/api/v1/events/${eventId}/complete`,
      { headers: { 'Authorization': `Bearer ${animateurToken}` } }
    );
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('AN-6: GET /animateur/checkins/today → check-ins visibles', async ({ request }) => {
    const response = await request.get(
      `${BASE}/api/v1/animateur/checkins/today`,
      { headers: { 'Authorization': `Bearer ${animateurToken}` } }
    );
    const data = await response.json();
    expect(response.ok()).toBeTruthy();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });
});
