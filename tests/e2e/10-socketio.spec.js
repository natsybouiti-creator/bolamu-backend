import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { io as ioClient } from 'socket.io-client';
dotenv.config();

const BASE = process.env.TEST_API_BASE || 'http://localhost:3005';

function generateToken(phone, role) {
  return jwt.sign({ phone, role }, process.env.JWT_SECRET, { expiresIn: '15min' });
}

function connectSocket() {
  return new Promise((resolve, reject) => {
    const s = ioClient(BASE, { transports: ['websocket'], reconnection: false });
    const t = setTimeout(() => reject(new Error('Timeout connexion socket')), 5000);
    s.on('connect', () => { clearTimeout(t); resolve(s); });
    s.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('Socket.io — Sprint 4', () => {
  let patientToken, adminToken, socketA;

  test.beforeAll(async () => {
    patientToken = generateToken('+242069735418', 'patient');
    adminToken = generateToken('+242060000099', 'admin');
    socketA = await connectSocket();
  });

  test.afterAll(() => { if (socketA) socketA.disconnect(); });

  test('SK-1: connexion établie', () => {
    expect(socketA.connected).toBe(true);
  });

  test('SK-2: join_conversation ne crashe pas', async () => {
    socketA.emit('join_conversation', 1);
    await new Promise(r => setTimeout(r, 300));
  });

  test('SK-3: message HTTP → new_message reçu via socket', async ({ request }) => {
    const convRes = await request.get(`${BASE}/api/v1/chat/conversations`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    expect(convRes.ok()).toBeTruthy();
    const convData = await convRes.json();
    const conversationId = convData.data?.[0]?.id;
    expect(conversationId).toBeTruthy();

    // rejoindre la room AVANT d'envoyer
    socketA.emit('join_conversation', conversationId);
    await new Promise(r => setTimeout(r, 300));

    // écouter AVANT de déclencher (sinon l'événement passe avant qu'on écoute)
    const received = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timeout new_message')), 4000);
      socketA.once('new_message', (msg) => { clearTimeout(t); resolve(msg); });
    });

    const sendRes = await request.post(
      `${BASE}/api/v1/chat/conversations/${conversationId}/messages`,
      { headers: { Authorization: `Bearer ${patientToken}` },
        data: { content: 'Test Socket.io Playwright' } }
    );
    expect(sendRes.ok()).toBeTruthy();

    const msg = await received;
    expect(msg).toHaveProperty('id');
    expect(msg).toHaveProperty('sent_at');
  });

  test('SK-4: action Zora → leaderboard_updated reçu via socket', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: BASE });

    // Vérifier que le socket est toujours connecté
    if (!socketA.connected) {
      console.log('[SK-4] Socket déconnecté, reconnexion...');
      socketA = await connectSocket();
    }

    // écouter AVANT de déclencher
    const received = new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Timeout leaderboard_updated')), 8000);
      socketA.once('leaderboard_updated', (data) => { clearTimeout(t); resolve(data); });
    });

    const earnRes = await ctx.post(`${BASE}/api/v1/zora/earn`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        phone: '+242069735418',
        action_type: 'bilan_annuel',
        proof_class: 'ground_truth',
        proof_source: 'test_playwright',
        recording_method: null,
        proof_reference: 'test_playwright_' + Date.now()
      }
    });
    expect(earnRes.ok()).toBeTruthy();
    const earnData = await earnRes.json();
    expect(earnData.success).toBe(true);

    const data = await received;
    expect(data).toHaveProperty('phone');
    expect(data).toHaveProperty('newBalance');

    await ctx.dispose();
  });
});
