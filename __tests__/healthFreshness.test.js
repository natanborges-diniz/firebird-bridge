const request = require('supertest');

// Mock do modulo de banco (mesmo padrao dos demais testes).
jest.mock('../src/db', () => ({
  query: jest.fn(),
  pingDatabase: jest.fn().mockResolvedValue({ ok: true }),
}));

const db = require('../src/db');
const app = require('../src/server');

// Data N dias atras (meia-noite UTC), para simular datas do Firebird.
function diasAtras(n) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

// Casa pelos aliases unicos do SELECT (os comentarios de um .sql citam o
// outro, entao casar por MON$CREATION_DATE / transacao daria falso match).
const isCreation = (sql) => /AS\s+creation_date/i.test(sql);
const isMovimentacao = (sql) => /AS\s+ultima/i.test(sql);

// Configura o mock: qual data cada sinal retorna, ou um erro para simular
// sinal indisponivel (ex.: Firebird < 3 sem MON$CREATION_DATE).
function mockSinais({ criacao, ultima, criacaoErro, ultimaErro }) {
  db.query.mockImplementation((sql) => {
    if (isCreation(sql)) {
      if (criacaoErro) return Promise.reject(criacaoErro);
      return Promise.resolve(criacao === undefined ? [] : [{ creation_date: criacao }]);
    }
    if (isMovimentacao(sql)) {
      if (ultimaErro) return Promise.reject(ultimaErro);
      return Promise.resolve(ultima === undefined ? [] : [{ ultima }]);
    }
    return Promise.resolve([]);
  });
}

describe('GET /api/v1/health/freshness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.FRESHNESS_MAX_LAG_DIAS;
  });

  test('copia de hoje + dados de hoje -> fresh, HTTP 200', async () => {
    mockSinais({ criacao: diasAtras(0), ultima: diasAtras(0) });

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('fresh');
    expect(res.body.data.copia_lag_dias).toBe(0);
    expect(res.body.data.dados_lag_dias).toBe(0);
  });

  // O caso REAL observado: restore roda hoje, mas a fonte esta congelada.
  test('copia de hoje + dados de 8 dias atras -> stale (dados_desatualizados)', async () => {
    mockSinais({ criacao: diasAtras(0), ultima: diasAtras(8) });

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('stale');
    expect(res.body.data.motivo_stale).toBe('dados_desatualizados');
    expect(res.body.data.dados_lag_dias).toBe(8);
    expect(res.body.data.copia_lag_dias).toBe(0);
  });

  test('job de restore parado: copia e dados de 8 dias atras -> stale (copia_parada)', async () => {
    mockSinais({ criacao: diasAtras(8), ultima: diasAtras(8) });

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.body.data.status).toBe('stale');
    expect(res.body.data.motivo_stale).toBe('copia_parada');
    expect(res.body.data.copia_lag_dias).toBe(8);
  });

  test('feriado: copia de hoje + dados de 2 dias atras, limite 2 -> fresh', async () => {
    mockSinais({ criacao: diasAtras(0), ultima: diasAtras(2) });

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.body.data.status).toBe('fresh');
    expect(res.body.data.dados_lag_dias).toBe(2);
  });

  test('Firebird sem MON$CREATION_DATE mas com dados recentes -> fresh (fallback hoje-dados)', async () => {
    mockSinais({ criacaoErro: new Error('Column unknown MON$CREATION_DATE'), ultima: diasAtras(0) });

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('fresh');
    expect(res.body.data.data_copia).toBeNull();
    expect(res.body.data.dados_lag_base).toBe('hoje');
    expect(res.body.data.avisos.length).toBeGreaterThan(0);
  });

  test('os dois sinais indisponiveis -> status indisponivel, HTTP 503', async () => {
    mockSinais({
      criacaoErro: new Error('Column unknown MON$CREATION_DATE'),
      ultimaErro: new Error('falha na conexao'),
    });

    const res = await request(app).get('/api/v1/health/freshness');

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.data.status).toBe('indisponivel');
  });
});
