const request = require('supertest');
const { pingDatabase } = require('../src/db');

jest.mock('../src/db', () => ({
  pingDatabase: jest.fn()
}));

const app = require('../src/server');

describe('Health check', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna 200 com payload ok quando Firebird está disponível', async () => {
    pingDatabase.mockResolvedValue({ ok: true });

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      version: expect.any(String),
      time: expect.any(String),
      uptime_s: expect.any(Number),
      db: {
        connected: true
      }
    });

    expect(new Date(res.body.time).toString()).not.toBe('Invalid Date');
  });

  it('retorna 503 com status degraded quando Firebird está indisponível', async () => {
    pingDatabase.mockResolvedValue({ ok: false, error: 'connection refused' });

    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({
      status: 'degraded',
      version: expect.any(String),
      time: expect.any(String),
      uptime_s: expect.any(Number),
      db: {
        connected: false
      },
      error: expect.any(String)
    });
  });
});

describe('Validação de parâmetros nas rotas', () => {
  it('financeiro/parcelas exige parâmetros obrigatórios', async () => {
    const res = await request(app).get('/api/v1/financeiro/parcelas');

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toMatch(/Parâmetros obrigatórios/i);
  });
});
