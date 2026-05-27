// ============================================================
// BOLAMU — Tests Unitaires Prorata Service (Sprint 5)
// ============================================================
const { calculProrata } = require('../../services/prorata.service');
const pool = require('../../config/db');

describe('Prorata Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculProrata', () => {
    it('Bronze→Silver → montant_du > 0', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ key: 'subscription_bronze_price', value: '15000' }]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ key: 'subscription_silver_price', value: '30000' }]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) }]
      });

      const result = await calculProrata('Bronze', 'Silver', new Date());

      expect(result.montant_du).toBeGreaterThan(0);
      expect(result.ancien_plan).toBe('Bronze');
      expect(result.nouveau_plan).toBe('Silver');
    });

    it('Silver→Gold → montant_du > 0', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ key: 'subscription_silver_price', value: '30000' }]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ key: 'subscription_gold_price', value: '50000' }]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) }]
      });

      const result = await calculProrata('Silver', 'Gold', new Date());

      expect(result.montant_du).toBeGreaterThan(0);
      expect(result.ancien_plan).toBe('Silver');
      expect(result.nouveau_plan).toBe('Gold');
    });

    it('cas limite → montant_du jamais négatif (TC-152)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ key: 'subscription_gold_price', value: '50000' }]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ key: 'subscription_bronze_price', value: '15000' }]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }]
      });

      const result = await calculProrata('Gold', 'Bronze', new Date());

      expect(result.montant_du).toBe(0);
      expect(result.montant_du).not.toBeLessThan(0);
    });

    it('upgrade dernier jour → jours_restants = 1', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ key: 'subscription_bronze_price', value: '15000' }]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ key: 'subscription_silver_price', value: '30000' }]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) }]
      });

      const result = await calculProrata('Bronze', 'Silver', new Date());

      expect(result.jours_restants).toBe(1);
    });
  });
});
