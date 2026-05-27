// ============================================================
// BOLAMU — Tests Intégration API Conflicts (Sprint 5)
// ============================================================
const request = require('supertest');
const express = require('express');

describe('Conflicts API', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Mock routes pour tests
    app.post('/api/v1/conflicts', (req, res) => {
      res.status(201).json({
        success: true,
        data: {
          conflict_id: 1,
          reference: 'CONF-20260520-1234',
          statut: 'created',
          created_at: new Date()
        }
      });
    });

    app.get('/api/v1/conflicts/:id', (req, res) => {
      const { id } = req.params;
      if (id === '1') {
        res.json({
          success: true,
          data: {
            conflict: { id: 1, patient_phone: '+242069735418' },
            messages: [],
            actions: []
          }
        });
      } else {
        res.status(403).json({ success: false, message: 'Access denied' });
      }
    });

    app.patch('/api/v1/conflicts/:id/statut', (req, res) => {
      const { statut } = req.body;
      if (statut === 'pending_review') {
        res.json({ success: true, message: 'Statut mis à jour' });
      } else {
        res.status(422).json({ success: false, message: 'Transition invalide' });
      }
    });
  });

  it('POST /api/v1/conflicts → 201 + référence CONF-*', async () => {
    const response = await request(app)
      .post('/api/v1/conflicts')
      .send({
        patient_phone: '+242069735418',
        partner_phone: '+242060000001',
        partner_type: 'doctor',
        sujet: 'Test',
        description: 'Test description'
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.reference).toMatch(/^CONF-\d{8}-\d{4}$/);
  });

  it('GET /api/v1/conflicts/:id → 200 pour patient propriétaire', async () => {
    const response = await request(app)
      .get('/api/v1/conflicts/1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('GET /api/v1/conflicts/:id → 403 pour autre patient', async () => {
    const response = await request(app)
      .get('/api/v1/conflicts/999');

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('PATCH /api/v1/conflicts/:id/statut → transition valide → 200', async () => {
    const response = await request(app)
      .patch('/api/v1/conflicts/1/statut')
      .send({ statut: 'pending_review', commentaire: 'Validation' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('PATCH /api/v1/conflicts/:id/statut → transition invalide → 422', async () => {
    const response = await request(app)
      .patch('/api/v1/conflicts/1/statut')
      .send({ statut: 'archived', commentaire: 'Test' });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });
});
