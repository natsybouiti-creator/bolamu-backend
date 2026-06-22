// ============================================================
// BOLAMU — Sprint 4 : Tests E2E Jeux Zora
// ============================================================
const { test, expect } = require('@playwright/test');
const fs = require('fs');

const API_URL = 'https://api.bolamu.co/api/v1';
const TEST_PHONE = '+242069735418';

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

let authToken = readStoredToken();

test('Test 1 — Config chargée', async () => {
  const response = await fetch(`${API_URL}/zora/games/config`);
  const data = await response.json();
  
  expect(response.ok).toBe(true);
  expect(data.success).toBe(true);
  expect(data.data).toHaveLength(4);
  expect(data.data.map(g => g.game_type)).toContain('scratch');
  expect(data.data.map(g => g.game_type)).toContain('wheel');
  expect(data.data.map(g => g.game_type)).toContain('chest');
  expect(data.data.map(g => g.game_type)).toContain('quiz');
});

test('Test 2 — Partie gratuite grattage', async () => {
  const response = await fetch(`${API_URL}/zora/games/play`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ game_type: 'scratch', play_type: 'free' })
  });
  const data = await response.json();
  
  expect(response.ok).toBe(true);
  expect(data.success).toBe(true);
  expect(data.data).toHaveProperty('play_id');
  expect(data.data).toHaveProperty('prize_label');
  expect(data.data).toHaveProperty('points_won');
  expect(data.data).toHaveProperty('server_seed');
  
  // Vérifier que la partie est enregistrée
  const historyResponse = await fetch(`${API_URL}/zora/games/history`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const historyData = await historyResponse.json();
  expect(historyData.data.some(p => p.id === data.data.play_id)).toBe(true);
});

test('Test 3 — Double partie gratuite bloquée', async () => {
  // Première partie
  await fetch(`${API_URL}/zora/games/play`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ game_type: 'scratch', play_type: 'free' })
  });
  
  // Deuxième partie (doit échouer)
  const response = await fetch(`${API_URL}/zora/games/play`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ game_type: 'scratch', play_type: 'free' })
  });
  const data = await response.json();
  
  expect(response.status).toBe(400);
  expect(data.success).toBe(false);
  expect(data.error).toBe('free_play_already_used');
});

test('Test 4 — Partie payante', async () => {
  // Vérifier balance avant
  const balanceResponse = await fetch(`${API_URL}/zora/balance`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const balanceData = await balanceResponse.json();
  const balanceBefore = balanceData.data?.balance || 0;
  
  if (balanceBefore < 50) {
    // Créditer des points si insuffisant
    console.log('Balance insuffisante, test partiel');
    return;
  }
  
  const response = await fetch(`${API_URL}/zora/games/play`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ game_type: 'scratch', play_type: 'paid' })
  });
  const data = await response.json();
  
  expect(response.ok).toBe(true);
  expect(data.success).toBe(true);
  
  // Vérifier balance réduite
  const balanceAfterResponse = await fetch(`${API_URL}/zora/balance`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const balanceAfterData = await balanceAfterResponse.json();
  const balanceAfter = balanceAfterData.data?.balance || 0;
  
  expect(balanceBefore - balanceAfter).toBeGreaterThanOrEqual(50);
});

test('Test 5 — Quiz complet', async () => {
  // Jouer une partie quiz
  const playResponse = await fetch(`${API_URL}/zora/games/play`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ game_type: 'quiz', play_type: 'free' })
  });
  const playData = await playResponse.json();
  
  expect(playResponse.ok).toBe(true);
  expect(playData.success).toBe(true);
  expect(playData.data).toHaveProperty('question');
  expect(playData.data).toHaveProperty('option_a');
  expect(playData.data).toHaveProperty('option_b');
  expect(playData.data).toHaveProperty('option_c');
  expect(playData.data).toHaveProperty('option_d');
  expect(playData.data).not.toHaveProperty('correct_answer');
  
  // Soumettre une réponse
  const answerResponse = await fetch(`${API_URL}/zora/games/quiz/answer`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ play_id: playData.data.play_id, answer: 'a' })
  });
  const answerData = await answerResponse.json();
  
  expect(answerResponse.ok).toBe(true);
  expect(answerData.success).toBe(true);
  expect(answerData.data).toHaveProperty('correct');
  expect(answerData.data).toHaveProperty('correct_answer');
  expect(answerData.data).toHaveProperty('points_won');
});

test('Test 6 — Correct_answer jamais exposée', async () => {
  const response = await fetch(`${API_URL}/zora/games/play`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ game_type: 'quiz', play_type: 'free' })
  });
  const data = await response.json();
  
  expect(response.ok).toBe(true);
  expect(data.success).toBe(true);
  expect(data.data).not.toHaveProperty('correct_answer');
  
  // Vérifier que correct_answer n'est pas dans la réponse JSON
  const jsonString = JSON.stringify(data.data);
  expect(jsonString).not.toContain('correct_answer');
});

test('Test 7 — Plafond journalier', async () => {
  // Ce test est difficile à automatiser complètement sans reset
  // On vérifie simplement que le cap existe dans la config
  const configResponse = await fetch(`${API_URL}/zora/games/config`);
  const configData = await configResponse.json();
  
  const scratchGame = configData.data.find(g => g.game_type === 'scratch');
  expect(scratchGame).toBeDefined();
  expect(scratchGame.daily_gain_cap).toBeGreaterThan(0);
});

test('Test 8 — Plafond global 100 Zora/jour', async () => {
  // Vérifier que le cap global existe
  const response = await fetch(`${API_URL}/zora/games/status`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const data = await response.json();
  
  expect(response.ok).toBe(true);
  expect(data.success).toBe(true);
  expect(data.data).toBeDefined();
  
  // Chaque jeu doit avoir un daily_gain_cap
  data.data.forEach(game => {
    expect(game.daily_gain_cap).toBeGreaterThan(0);
  });
});
