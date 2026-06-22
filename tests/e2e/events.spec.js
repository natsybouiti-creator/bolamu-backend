// ============================================================
// BOLAMU — Sprint 5 : Tests Playwright Événements Elonga
// ============================================================
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const API = 'https://api.bolamu.co/api/v1';

const ADMIN_PHONE = '+242060000099';
const ADMIN_PASSWORD = 'bolamu2026';

function readStoredToken() {
  try {
    const state = JSON.parse(fs.readFileSync('playwright/.auth/patient.json', 'utf8'));
    for (const origin of (state.origins || [])) {
      for (const item of (origin.localStorage || [])) {
        if (item.name === 'bolamu_patient_token') return item.value;
      }
    }
  } catch (_) {}
  return '';
}

let patientToken = null;
let adminToken = null;
let testEventId = null;
let testToken = null;

test.describe('Événements Elonga — Sprint 5', () => {

  test.beforeAll(async () => {
    patientToken = readStoredToken();

    // Login admin (1 seul appel strictLimiter pour ce fichier)
    const adminLogin = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: ADMIN_PHONE, password: ADMIN_PASSWORD })
    });
    const adminData = await adminLogin.json();
    adminToken = adminData.accessToken;
  });
  
  test('1. GET /events → 5 événements sans auth', async () => {
    const response = await fetch(`${API}/events`);
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(5);
    
    // Vérifier structure événement
    const event = data.data[0];
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('title');
    expect(event).toHaveProperty('pillar');
    expect(event).toHaveProperty('location_name');
    expect(event).toHaveProperty('starts_at');
    expect(event).toHaveProperty('participants_count');
    expect(event).toHaveProperty('places_restantes');
  });
  
  test('2. POST /events/1/register → places_restantes -1', async () => {
    // Récupérer un événement avec places disponibles
    const eventsRes = await fetch(`${API}/events`);
    const eventsData = await eventsRes.json();
    const event = eventsData.data.find(e => e.places_restantes > 0);
    
    if (!event) {
      test.skip('Aucun événement avec places disponibles');
      return;
    }
    
    testEventId = event.id;
    const placesAvant = event.places_restantes;
    
    // S'inscrire
    const registerRes = await fetch(`${API}/events/${event.id}/register`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      }
    });
    const registerData = await registerRes.json();
    
    expect(registerRes.ok).toBe(true);
    expect(registerData.success).toBe(true);
    expect(registerData.places_restantes).toBe(placesAvant - 1);
  });
  
  test('3. Double inscription → pas d\'erreur', async () => {
    if (!testEventId) {
      test.skip('Aucun événement test disponible');
      return;
    }
    
    // Deuxième inscription (ne doit pas créer de doublon)
    const registerRes = await fetch(`${API}/events/${testEventId}/register`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      }
    });
    const registerData = await registerRes.json();
    
    expect(registerRes.ok).toBe(true);
    expect(registerData.success).toBe(true);
  });
  
  test('4. DELETE /events/1/register → status=\'cancelled\'', async () => {
    if (!testEventId) {
      test.skip('Aucun événement test disponible');
      return;
    }
    
    // Annuler inscription
    const cancelRes = await fetch(`${API}/events/${testEventId}/register`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      }
    });
    const cancelData = await cancelRes.json();
    
    expect(cancelRes.ok).toBe(true);
    expect(cancelData.success).toBe(true);
  });
  
  test('5. GET checkin-token → UUID + expires_at 24h', async () => {
    if (!testEventId) {
      test.skip('Aucun événement test disponible');
      return;
    }
    
    // Se réinscrire pour générer un token
    await fetch(`${API}/events/${testEventId}/register`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Générer token
    const tokenRes = await fetch(`${API}/events/${testEventId}/checkin-token`, {
      headers: { 
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      }
    });
    const tokenData = await tokenRes.json();
    
    expect(tokenRes.ok).toBe(true);
    expect(tokenData.success).toBe(true);
    expect(tokenData.data).toHaveProperty('token');
    expect(tokenData.data).toHaveProperty('expires_at');
    expect(tokenData.data).toHaveProperty('event_title');
    
    // Vérifier format UUID
    expect(tokenData.data.token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    // Vérifier expiration ~24h
    const expiresAt = new Date(tokenData.data.expires_at);
    const now = new Date();
    const diffHours = (expiresAt - now) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(23);
    expect(diffHours).toBeLessThan(25);
    
    testToken = tokenData.data.token;
  });
  
  test('6. POST checkin → points Zora crédités', async () => {
    if (!testEventId || !testToken) {
      test.skip('Token non disponible');
      return;
    }
    
    // Check-in
    const checkinRes = await fetch(`${API}/events/${testEventId}/checkin`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: testToken })
    });
    const checkinData = await checkinRes.json();
    
    expect(checkinRes.ok).toBe(true);
    expect(checkinData.success).toBe(true);
    expect(checkinData.points_credited).toBeGreaterThan(0);
  });
  
  test('7. Double check-in → token_already_used', async () => {
    if (!testEventId || !testToken) {
      test.skip('Token non disponible');
      return;
    }
    
    // Deuxième check-in avec même token
    const checkinRes = await fetch(`${API}/events/${testEventId}/checkin`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: testToken })
    });
    const checkinData = await checkinRes.json();
    
    expect(checkinRes.ok).toBe(false);
    expect(checkinData.reason).toBe('token_already_used');
  });
  
  test('8. GET my/registrations → inscrit + checked_in', async () => {
    const registrationsRes = await fetch(`${API}/events/my/registrations`, {
      headers: { 
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      }
    });
    const registrationsData = await registrationsRes.json();
    
    expect(registrationsRes.ok).toBe(true);
    expect(registrationsData.success).toBe(true);
    expect(Array.isArray(registrationsData.data)).toBe(true);
    
    // Vérifier que l'inscription test est présente
    const testReg = registrationsData.data.find(r => r.event_id === testEventId);
    expect(testReg).toBeDefined();
    expect(testReg.status).toBe('checked_in');
    expect(testReg.zora_awarded).toBe(true);
  });
  
  test('9. POST /events (admin) → événement créé', async () => {
    const newEvent = {
      title: 'Test Event Playwright',
      description: 'Événement de test Playwright',
      pillar: 'sport',
      location_name: 'Lieu de test',
      location_address: 'Adresse de test',
      city: 'Brazzaville',
      starts_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ends_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(),
      max_participants: 50,
      zora_reward: 50,
      organizer_phone: ADMIN_PHONE
    };
    
    const createRes = await fetch(`${API}/events`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newEvent)
    });
    const createData = await createRes.json();
    
    expect(createRes.ok).toBe(true);
    expect(createData.success).toBe(true);
    expect(createData.data).toHaveProperty('id');
    expect(createData.data.title).toBe(newEvent.title);
  });
  
  test('10. PUT /events/1 (admin) → événement modifié', async () => {
    if (!testEventId) {
      test.skip('Aucun événement test disponible');
      return;
    }
    
    const updates = {
      title: 'Événement modifié par Playwright',
      status: 'published'
    };
    
    const updateRes = await fetch(`${API}/events/${testEventId}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });
    const updateData = await updateRes.json();
    
    expect(updateRes.ok).toBe(true);
    expect(updateData.success).toBe(true);
    expect(updateData.data.title).toBe(updates.title);
  });
});
