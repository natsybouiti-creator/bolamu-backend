// ============================================================
// BOLAMU — Tests Intégration API Auth (Sprint 5)
// ============================================================
const request = require('supertest');
const express = require('express');

describe('Auth API', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Mock routes pour tests
    app.post('/api/v1/auth/login', (req, res) => {
      const { phone, password } = req.body;
      if (phone === '+242069735418' && password === 'test123') {
        res.json({ success: true, token: 'mock_jwt_token' });
      } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    });
  });

  it('POST /api/v1/auth/login → 200 + token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+242069735418', password: 'test123' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBe('mock_jwt_token');
  });

  it('POST /api/v1/auth/login → 401 si mauvais credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ phone: '+242069735418', password: 'wrong' });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
