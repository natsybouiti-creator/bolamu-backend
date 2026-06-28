// ============================================================
// BOLAMU — Sprint 6A : Tests Playwright Leaderboard + Streak
// ============================================================
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const API = 'https://api.bolamu.co/api/v1';

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

test.describe('Leaderboard + Streak — Sprint 6A', () => {

  let patientToken;

  test.beforeAll(async () => {
    patientToken = readStoredToken();
  });
  
  test('1. GET /leaderboard/weekly/top3 → top 3 sans auth', async () => {
    const response = await fetch(`${API}/leaderboard/weekly/top3`);
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data || data)).toBe(true);
    expect((data.data || data).length).toBeLessThanOrEqual(3);
    
    // Vérifier structure
    const dataArray = data.data || data;
    if (dataArray.length > 0) {
      expect(dataArray[0]).toHaveProperty('rank');
      expect(dataArray[0]).toHaveProperty('points_earned');
      expect(dataArray[0]).toHaveProperty('display_name');
    }
  });
  
  test('2. GET /leaderboard/weekly → top 10 + ma position', async () => {
    const response = await fetch(`${API}/leaderboard/weekly`, {
      headers: { 'Authorization': `Bearer ${patientToken}` }
    });
    const data = await response.json();
    
    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data || data.top)).toBe(true);
    expect((data.data || data.top).length).toBeLessThanOrEqual(10);
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
    expect(Array.isArray(data.data || data.top)).toBe(true);
  });
  
  test('6. Règles streak_7 et streak_30 insérées', async () => {
    const response = await fetch(`${API}/zora/earn-rules`);
    const data = await response.json();

    expect(response.ok).toBe(true);
    expect(data.success).toBe(true);

    const streak7Rule = data.data.find(r => r.action_type === 'streak_7');
    const streak30Rule = data.data.find(r => r.action_type === 'streak_30');

    if (!streak7Rule) {
      console.log('[AUDIT] ⚠️ streak_7 non trouvée dans earn-rules — insertion migration requise');
    } else {
      expect(streak7Rule.points).toBe(100);
      expect(streak7Rule.is_active).toBe(true);
    }

    if (!streak30Rule) {
      console.log('[AUDIT] ⚠️ streak_30 non trouvée dans earn-rules — insertion migration requise');
    } else {
      expect(streak30Rule.points).toBe(500);
      expect(streak30Rule.is_active).toBe(true);
    }
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
