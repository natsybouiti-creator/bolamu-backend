// ============================================================
// BOLAMU — Tests Unitaires Conflict Service (Sprint 5)
// ============================================================
const { generateReference, transitionStatut, createConflict } = require('../../services/conflict.service');
const pool = require('../../config/db');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

describe('Conflict Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReference', () => {
    it('format CONF-YYYYMMDD-XXXX', () => {
      const reference = generateReference();
      const regex = /^CONF-\d{8}-\d{4}$/;
      expect(reference).toMatch(regex);
    });

    it('référence unique à chaque appel', () => {
      const ref1 = generateReference();
      const ref2 = generateReference();
      expect(ref1).not.toBe(ref2);
    });
  });

  describe('transitionStatut', () => {
    it('transition valide → succès', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({ rows: [{ statut: 'created' }] }),
        release: jest.fn()
      };
      pool.connect.mockResolvedValue(client);

      const result = await transitionStatut(1, 'pending_review', '+242069735418', 'patient', 'Validation');

      expect(result.success).toBe(true);
      expect(result.message).toContain('pending_review');
    });

    it('transition invalide → throw Error', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({ rows: [{ statut: 'created' }] }),
        release: jest.fn()
      };
      pool.connect.mockResolvedValue(client);

      await expect(
        transitionStatut(1, 'archived', '+242069735418', 'patient', 'Test')
      ).rejects.toThrow('Transition invalide');
    });
  });

  describe('createConflict', () => {
    it('référence unique générée', async () => {
      const client = {
        query: jest.fn().mockResolvedValue({ rows: [{ id: 1, reference: 'CONF-20260520-1234', statut: 'created', created_at: new Date() }] }),
        release: jest.fn()
      };
      pool.connect.mockResolvedValue(client);

      const result = await createConflict({
        patient_phone: '+242069735418',
        partner_phone: '+242060000001',
        partner_type: 'doctor',
        sujet: 'Test',
        description: 'Test description'
      });

      expect(result.success).toBe(true);
      expect(result.data.reference).toMatch(/^CONF-\d{8}-\d{4}$/);
    });
  });
});
