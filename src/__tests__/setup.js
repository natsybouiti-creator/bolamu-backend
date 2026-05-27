// ============================================================
// BOLAMU — Jest Setup (Sprint 5)
// ============================================================

// Variables d'environnement de test
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_bolamu_2026';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/bolamu_test';

// Mock de la connexion base de données pour les tests unitaires
jest.mock('../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(() => ({
    query: jest.fn(),
    release: jest.fn()
  }))
}));
