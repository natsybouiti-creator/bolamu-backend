// ============================================================
// BOLAMU — Tests Unitaires Idempotence Middleware (Sprint 5)
// ============================================================
const idempotencyMiddleware = require('../../middleware/idempotency');
const pool = require('../../config/db');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
}));

describe.skip('Idempotence Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
      user: { phone: '+242069735418' },
      body: {},
      url: '/api/v1/test'
    };
    let statusCode = 200;
    res = {
      status: jest.fn().mockImplementation((code) => {
        statusCode = code;
        return res;
      }),
      set: jest.fn().mockReturnThis(),
      json: jest.fn(),
      get statusCode() { return statusCode; },
      set statusCode(code) { statusCode = code; }
    };
    next = jest.fn();
  });

  it('première requête → traitée normalement', async () => {
    req.headers = {};
    req.user = { phone: '+242069735418' };
    req.body = { test: 'data' };
    req.url = '/api/v1/test';

    const middleware = idempotencyMiddleware('/api/v1/test');
    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('deuxième requête même clé → réponse cachée retournée', async () => {
    req.headers = { 'idempotency-key': 'test-key-123' };
    req.user = { phone: '+242069735418' };
    req.body = { test: 'data' };
    req.url = '/api/v1/test';

    pool.query.mockResolvedValueOnce({
      rows: [{
        response_status: 200,
        response_body: { success: true, data: 'cached' }
      }]
    });

    const middleware = idempotencyMiddleware('/api/v1/test');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: 'cached' });
    expect(res.set).toHaveBeenCalledWith('X-Idempotent-Replayed', 'true');
    expect(next).not.toHaveBeenCalled();
  });

  it('requête en cours → HTTP 409', async () => {
    req.headers = { 'idempotency-key': 'test-key-456' };
    req.user = { phone: '+242069735418' };
    req.body = { test: 'data' };
    req.url = '/api/v1/test';

    pool.query.mockResolvedValueOnce({
      rows: [{
        response_status: null,
        response_body: null
      }]
    });

    const middleware = idempotencyMiddleware('/api/v1/test');
    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Requête en cours de traitement'
    });
    expect(next).not.toHaveBeenCalled();
  });
});
