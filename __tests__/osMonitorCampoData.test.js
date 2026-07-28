const request = require('supertest');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  pingDatabase: jest.fn().mockResolvedValue(true),
}));

const db = require('../src/db');
const app = require('../src/server');

describe('OS monitor-ultima-etapa: parametro campoData', () => {
  const base = { dataInicio: '2026-06-28', dataFim: '2026-07-28', codEmpresa: 'ALL' };

  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue([]);
  });

  it('usa ocx.dataemissao por padrao (sem campoData)', async () => {
    const res = await request(app).get('/api/v1/os/monitor-ultima-etapa').query(base);
    expect(res.status).toBe(200);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('ocx.dataemissao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)');
  });

  it('filtra por ocx.dataprevisao quando campoData=data_previsao', async () => {
    const res = await request(app)
      .get('/api/v1/os/monitor-ultima-etapa')
      .query({ ...base, campoData: 'data_previsao' });
    expect(res.status).toBe(200);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('ocx.dataprevisao BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)');
    expect(sql).not.toContain('ocx.dataemissao BETWEEN');
  });

  it('filtra por datahoraentrada quando campoData=data_entrada', async () => {
    const res = await request(app)
      .get('/api/v1/os/monitor-ultima-etapa')
      .query({ ...base, campoData: 'data_entrada' });
    expect(res.status).toBe(200);
    const sql = db.query.mock.calls[0][0];
    expect(sql).toContain('CAST(l.datahoraentrada AS DATE) BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)');
  });

  it('rejeita campoData invalido com 400 e nao consulta o banco', async () => {
    const res = await request(app)
      .get('/api/v1/os/monitor-ultima-etapa')
      .query({ ...base, campoData: 'data_qualquer' });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PARAMS');
    expect(db.query).not.toHaveBeenCalled();
  });
});
