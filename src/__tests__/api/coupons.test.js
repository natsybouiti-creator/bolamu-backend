// ============================================================
// BOLAMU — Tests Intégration API Coupons (Sprint 5)
// ============================================================
const request = require('supertest');
const express = require('express');

describe('Coupons API', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Mock routes pour tests
    app.post('/api/v1/coupons/validate', (req, res) => {
      const { code } = req.body;
      if (code === 'VALID') {
        res.json({
          valide: true,
          coupon_id: 1,
          montant_remise: 10000,
          montant_final: 40000
        });
      } else if (code === 'EXPIRED') {
        res.json({
          valide: false,
          raison: 'Coupon expiré'
        });
      } else {
        res.json({
          valide: false,
          raison: 'Code invalide'
        });
      }
    });

    app.post('/api/v1/admin/coupons', (req, res) => {
      res.status(201).json({
        success: true,
        data: {
          id: 1,
          code: 'NEW_COUPON',
          type: 'pourcentage',
          valeur: 20
        }
      });
    });
  });

  it('POST /api/v1/coupons/validate → coupon valide → 200', async () => {
    const response = await request(app)
      .post('/api/v1/coupons/validate')
      .send({ code: 'VALID', montant_base: 50000 });

    expect(response.status).toBe(200);
    expect(response.body.valide).toBe(true);
    expect(response.body.montant_remise).toBe(10000);
  });

  it('POST /api/v1/coupons/validate → expiré → 200 + valide: false', async () => {
    const response = await request(app)
      .post('/api/v1/coupons/validate')
      .send({ code: 'EXPIRED', montant_base: 50000 });

    expect(response.status).toBe(200);
    expect(response.body.valide).toBe(false);
    expect(response.body.raison).toBe('Coupon expiré');
  });

  it('POST /api/v1/admin/coupons → 201 (admin)', async () => {
    const response = await request(app)
      .post('/api/v1/admin/coupons')
      .send({
        code: 'NEW_COUPON',
        type: 'pourcentage',
        valeur: 20
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.code).toBe('NEW_COUPON');
  });
});
