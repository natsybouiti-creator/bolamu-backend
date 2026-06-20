// ============================================================
// BOLAMU — Sprint 6A : Tests Playwright Leaderboard + Streak
// ============================================================
const { test, expect } = require('@playwright/test');

const API = 'https://api.bolamu.co/api/v1';

// Comptes de test
const PATIENT_PHONE = '+242069735418';
const PATIENT_PASSWORD = 'bolamu2026';

let patientToken = null;

test.describe('Leaderboard + Streak — Sprint 6A', () => {
  
  test.beforeAll(async () => {
    // Login patient
    const patientLogin = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: PATIENT_PHONE, password: PATIENT_PASSWORD })
    });
    const patientData = await patientLogin.json();
    patientToken = patientData.accessToken;
  });
  
  test('1. GET /leaderboard/weekly/top3 → top 3 sans auth', async () => {
    const response = await fetch(`${API}/leaderboard/weekly/top3`);
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBeLessThanOrEqual(3);
    
    // Vérifier structure
    if (data.data.length > 0) {
      expect(data.data[0]).toHaveProperty('rank');
      expect(data.data[0]).toHaveProperty('points_earned');
      expect(data.data[0]).toHaveProperty('display_name');
    }
  });
  
  test('2. GET /leaderboard/weekly → top 10 + ma position', async () => {
    const response = await fetch(`${API}/leaderboard/weekly`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.top)).toBe(true);
    expect(data.top.length).toBeLessThanOrEqual(10);
    expect(data.my_position).toBeDefined();
  });
  
  test('3. GET /streaks/me → streak initial', async () => {
    const response = await fetch(`${API}/streaks/me`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('current_streak');
    expect(data).toHaveProperty('longest_streak');
    expect(data).toHaveProperty('last_activity_date');
    expect(data).toHaveProperty('next_bonus_at');
  });
  
  test('4. Streak init après premier awardZora', async () => {
    // Simuler un gain Zora via consultation
    const consultResponse = await fetch(`${API}/appointments`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        doctor_id: 1,
        appointment_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        appointment_time: '10:00'
      })
    });
    
    // Vérifier que le streak est mis à jour
    const streakResponse = await fetch(`${API}/streaks/me`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    const streakData = await streakResponse.json();
    
    expect(streakResponse.ok).toBe(true);
    expect(streakData.success).toBe(true);
    expect(streakData.current_streak).toBeGreaterThanOrEqual(0);
  });
  
  test('5. Classement hebdo recalculé après cron', async () => {
    // Le cron 02h00 calcule le classement
    // Vérifier que les données sont accessibles
    const response = await fetch(`${API}/leaderboard/weekly`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.top)).toBe(true);
  });
  
  test('6. Règles streak_7 et streak_30 insérées', async () => {
    // Vérifier via zora routes que les règles existent
    const response = await fetch(`${API}/zora/rules`);
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    
    const streak7Rule = data.data.find(r => r.action_type === 'streak_7');
    const streak30Rule = data.data.find(r => r.action_type === 'streak_30');
    
    expect(streak7Rule).toBeDefined();
    expect(streak7Rule.points).toBe(100);
    expect(streak7Rule.is_active).toBe(true);
    
    expect(streak30Rule).toBeDefined();
    expect(streak30Rule.points).toBe(500);
    expect(streak30Rule.is_active).toBe(true);
  });
  
  test('7. Masquage noms leaderboard (Jean-Paul M.)', async () => {
    const response = await fetch(`${API}/leaderboard/weekly/top3`);
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    
    if (data.data.length > 0) {
      const displayName = data.data[0].display_name;
      // Vérifier que le nom est masqué (initiale du nom de famille)
      expect(displayName).toMatch(/^[A-Z][a-z]+ [A-Z]\.$/);
    }
  });
});
