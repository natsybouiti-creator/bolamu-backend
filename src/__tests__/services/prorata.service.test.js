// ============================================================
// BOLAMU — Tests Unitaires Prorata Service
// ============================================================
const { calculProrata } = require('../../services/prorata.service');
const pool = require('../../config/db');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

const PATIENT_PHONE = '+242060000001';

describe('Prorata Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculProrata', () => {
    it('essentiel→standard → montant_du > 0', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { config_key: 'price_essentiel', config_value: '2000' },
          { config_key: 'price_standard',  config_value: '4000' },
          { config_key: 'price_premium',   config_value: '10000' }
        ]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) }]
      });

      const result = await calculProrata(PATIENT_PHONE, 'essentiel', 'standard', new Date());

      expect(result.montant_du).toBeGreaterThan(0);
      expect(result.ancien_plan).toBe('essentiel');
      expect(result.nouveau_plan).toBe('standard');
    });

    it('standard→premium → montant_du > 0', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { config_key: 'price_essentiel', config_value: '2000' },
          { config_key: 'price_standard',  config_value: '4000' },
          { config_key: 'price_premium',   config_value: '10000' }
        ]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ expires_at: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) }]
      });

      const result = await calculProrata(PATIENT_PHONE, 'standard', 'premium', new Date());

      expect(result.montant_du).toBeGreaterThan(0);
      expect(result.ancien_plan).toBe('standard');
      expect(result.nouveau_plan).toBe('premium');
    });

    it('cas limite → montant_du jamais négatif (TC-152)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { config_key: 'price_essentiel', config_value: '2000' },
          { config_key: 'price_standard',  config_value: '4000' },
          { config_key: 'price_premium',   config_value: '10000' }
        ]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }]
      });

      const result = await calculProrata(PATIENT_PHONE, 'premium', 'essentiel', new Date());

      expect(result.montant_du).toBe(0);
      expect(result.montant_du).not.toBeLessThan(0);
    });

    it('upgrade dernier jour → jours_restants = 1', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [
          { config_key: 'price_essentiel', config_value: '2000' },
          { config_key: 'price_standard',  config_value: '4000' },
          { config_key: 'price_premium',   config_value: '10000' }
        ]
      });
      pool.query.mockResolvedValueOnce({
        rows: [{ expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) }]
      });

      const result = await calculProrata(PATIENT_PHONE, 'essentiel', 'standard', new Date());

      expect(result.jours_restants).toBe(1);
    });
  });
});
