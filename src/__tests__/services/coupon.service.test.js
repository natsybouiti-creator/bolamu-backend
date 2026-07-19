// ============================================================
// BOLAMU — Tests Unitaires Coupon Service (Sprint 5)
// ============================================================
const { validateCoupon, applyCoupon, createCoupon } = require('../../services/coupon.service');
const pool = require('../../config/db');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

describe.skip('Coupon Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateCoupon', () => {
    it('coupon valide → retourne montant_remise correct', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          code: 'BOLAMU2024',
          type: 'pourcentage',
          valeur: 20,
          quota_total: 100,
          quota_utilise: 50,
          date_expiration: '2025-12-31',
          user_type_restriction: 'patient',
          usage_unique_par_user: true,
          is_active: true
        }]
      });
      pool.query.mockResolvedValueOnce({ rows: [] });

      const result = await validateCoupon('BOLAMU2024', '+242069735418', 'patient', 50000);

      expect(result.valide).toBe(true);
      expect(result.montant_remise).toBe(10000);
      expect(result.montant_final).toBe(40000);
    });

    it('coupon expiré → { valide: false, raison: "Coupon expiré" }', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          code: 'EXPIRED',
          type: 'pourcentage',
          valeur: 20,
          quota_total: 100,
          quota_utilise: 50,
          date_expiration: '2020-01-01',
          user_type_restriction: 'patient',
          usage_unique_par_user: true,
          is_active: true
        }]
      });

      const result = await validateCoupon('EXPIRED', '+242069735418', 'patient', 50000);

      expect(result.valide).toBe(false);
      expect(result.raison).toBe('Coupon expiré');
    });

    it('quota épuisé → { valide: false, raison: "Quota épuisé" }', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          code: 'QUOTA_FULL',
          type: 'pourcentage',
          valeur: 20,
          quota_total: 100,
          quota_utilise: 100,
          date_expiration: '2025-12-31',
          user_type_restriction: 'patient',
          usage_unique_par_user: true,
          is_active: true
        }]
      });

      const result = await validateCoupon('QUOTA_FULL', '+242069735418', 'patient', 50000);

      expect(result.valide).toBe(false);
      expect(result.raison).toBe('Quota épuisé');
    });

    it('mauvais user_type → raison explicite', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          code: 'PATIENT_ONLY',
          type: 'pourcentage',
          valeur: 20,
          quota_total: 100,
          quota_utilise: 50,
          date_expiration: '2025-12-31',
          user_type_restriction: 'patient',
          usage_unique_par_user: true,
          is_active: true
        }]
      });

      const result = await validateCoupon('PATIENT_ONLY', '+242060000001', 'doctor', 50000);

      expect(result.valide).toBe(false);
      expect(result.raison).toBe('Coupon non applicable à ce profil');
    });

    it('déjà utilisé → raison explicite', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          code: 'USED',
          type: 'pourcentage',
          valeur: 20,
          quota_total: 100,
          quota_utilise: 50,
          date_expiration: '2025-12-31',
          user_type_restriction: null,
          usage_unique_par_user: true,
          is_active: true
        }]
      });
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });

      const result = await validateCoupon('USED', '+242069735418', 'patient', 50000);

      expect(result.valide).toBe(false);
      expect(result.raison).toBe('Déjà utilisé par ce compte');
    });
  });

  describe('applyCoupon', () => {
    it('transaction complète sans erreur', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn()
      };
      pool.connect.mockResolvedValue(client);

      const result = await applyCoupon(1, '+242069735418', 123, 10000);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Coupon appliqué avec succès');
    });
  });
});
