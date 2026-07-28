const request = require('supertest');

// Mock do modulo de banco (mesmo padrao dos demais testes).
jest.mock('../src/db', () => ({
  query: jest.fn(),
  pingDatabase: jest.fn().mockResolvedValue({ ok: true }),
}));

const db = require('../src/db');
const app = require('../src/server');

// Data N dias atras (meia-noite UTC), para simular MON$CREATION_DATE.
function diasAtras(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

describe('GET /api/v1/health/freshness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FRESHNESS_MAX_LAG_DIAS;
  });

  test('copia recente -> status fresh, lag pequeno, HTTP 200', async () => {
    db.query.mockResolvedValueOnce([{ creation_date: diasAtras(0) }]);

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('fresh');
    expect(res.body.data.lag_dias).toBe(0);
    expect(res.body.data.fonte).toBe('MON$CREATION_DATE');
  });

  test('copia parada ha 8 dias -> status stale', async () => {
    db.query.mockResolvedValueOnce([{ creation_date: diasAtras(8) }]);

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('stale');
    expect(res.body.data.lag_dias).toBe(8);
    expect(res.body.data.limite_dias).toBe(2);
  });

  test('limite configuravel via env absorve fim de semana', async () => {
    process.env.FRESHNESS_MAX_LAG_DIAS = '3';
    db.query.mockResolvedValueOnce([{ creation_date: diasAtras(3) }]);

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.body.data.status).toBe('fresh');
    expect(res.body.data.lag_dias).toBe(3);
    expect(res.body.data.limite_dias).toBe(3);
  });

  test('MON$CREATION_DATE indisponivel (Firebird antigo) -> status indisponivel, HTTP 503', async () => {
    db.query.mockRejectedValueOnce(new Error('Column unknown MON$CREATION_DATE'));

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.data.status).toBe('indisponivel');
    expect(res.body.error).toMatch(/MON\$CREATION_DATE/);
  });
});
