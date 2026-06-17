const fs = require('fs');
const path = require('path');
const request = require('supertest');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  runQuery: jest.fn(),
  pingDatabase: jest.fn().mockResolvedValue({ ok: true }),
}));

const db = require('../src/db');
const app = require('../src/server');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'queries', 'estoque', 'estoque_ultimo_custo.sql'),
  'utf8'
);

// ─── testes de estrutura SQL ──────────────────────────────────────────────────

describe('queries/estoque/estoque_ultimo_custo.sql', () => {
  it('filtra estoque na CTE tbestoque antes de qualquer join', () => {
    expect(sql).toMatch(/tbestoque\s+AS\s*\(/i);
    expect(sql).toMatch(/estoque\.cod_empresa\s*=\s*CAST\(\?\s+AS\s+INTEGER\)/i);
    expect(sql).toMatch(/cod_estoquelocal\s*=\s*1/i);
    expect(sql).toMatch(/saldo\s*>\s*0/i);
  });

  it('usa ROW_NUMBER() por dataencerramento DESC para pegar entrada mais recente (NFe)', () => {
    expect(sql).toMatch(/ROW_NUMBER\(\)\s+OVER\s*\(/i);
    expect(sql).toMatch(/PARTITION\s+BY\s+ti\.cod_item.*t\.cod_empresa/is);
    expect(sql).toMatch(/ORDER\s+BY\s+t\.dataencerramento\s+DESC/i);
  });

  it('filtra apenas entradas de compra (naturezaoperacao.tipo = 2)', () => {
    expect(sql).toMatch(/naturezaoperacao/i);
    expect(sql).toMatch(/nat\.tipo\s*=\s*2/i);
  });

  it('usa NULLIF para converter valorunitario=0 em NULL', () => {
    expect(sql).toMatch(/NULLIF\s*\(\s*ti\.valorunitario\s*,\s*0\s*\)/i);
  });

  it('inclui fallback ESTOQUELOG via subquery correlacionada (FIRST 1)', () => {
    expect(sql).toMatch(/estoquelog/i);
    expect(sql).toMatch(/el\.precocusto/i);
    expect(sql).toMatch(/NULLIF\s*\(\s*el\.precocusto\s*,\s*0\s*\)/i);
    expect(sql).toMatch(/FIRST\s+1/i);
    expect(sql).toMatch(/ORDER\s+BY\s+el\.data\s+DESC/i);
  });

  it('usa COALESCE para preferir NFe e cair no ESTOQUELOG', () => {
    expect(sql).toMatch(/COALESCE\s*\(\s*tbEntradas\.custo_ultima_compra/i);
    expect(sql).toMatch(/COALESCE\s*\(\s*tbEntradas\.data_ultima_compra/i);
  });

  it('expõe contrato de colunas: cod_sku, custo_ultima_compra, data_ultima_compra, origem_custo', () => {
    expect(sql).toMatch(/AS\s+cod_sku/i);
    expect(sql).toMatch(/AS\s+custo_ultima_compra/i);
    expect(sql).toMatch(/AS\s+data_ultima_compra/i);
    expect(sql).toMatch(/AS\s+origem_custo/i);
  });

  it("origem_custo = 'NFE' | 'ESTOQUELOG' | NULL via CASE", () => {
    expect(sql).toMatch(/'NFE'/i);
    expect(sql).toMatch(/'ESTOQUELOG'/i);
    expect(sql).toMatch(/CASE/i);
  });

  it('faz LEFT JOIN para incluir SKUs sem qualquer histórico (custo NULL)', () => {
    expect(sql).toMatch(/LEFT\s+JOIN\s+tbEntradas/i);
    expect(sql).toMatch(/tbEntradas\.rn\s*=\s*1/i);
  });
});

// ─── testes de endpoint ────────────────────────────────────────────────────────

describe('GET /api/v1/estoque/ultimo-custo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
    db.runQuery.mockReset();
  });

  it('retorna 400 quando empresa está ausente', async () => {
    const res = await request(app).get('/api/v1/estoque/ultimo-custo');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false });
  });

  it('retorna 400 para empresa não numérica', async () => {
    const res = await request(app)
      .get('/api/v1/estoque/ultimo-custo')
      .query({ empresa: 'abc' });
    expect(res.status).toBe(400);
  });

  it('retorna array vazio quando banco não retorna linhas', async () => {
    db.query.mockResolvedValue([]);
    db.runQuery.mockResolvedValue([]);
    const res = await request(app)
      .get('/api/v1/estoque/ultimo-custo')
      .query({ empresa: '1' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, data: [] });
  });

  it('caso NFE: retorna origem_custo=NFE quando custo vem de entrada tipo=2', async () => {
    const mockRows = [
      { cod_sku: 123, custo_ultima_compra: 91.66, data_ultima_compra: new Date('2024-03-15'), origem_custo: 'NFE' },
    ];
    db.query.mockResolvedValue(mockRows);
    db.runQuery.mockResolvedValue(mockRows);
    const res = await request(app)
      .get('/api/v1/estoque/ultimo-custo')
      .query({ empresa: '1' });
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      cod_sku: 123,
      custo_ultima_compra: 91.66,
      origem_custo: 'NFE',
    });
  });

  it('caso ESTOQUELOG: retorna origem_custo=ESTOQUELOG para transferências sem NFe', async () => {
    const mockRows = [
      { cod_sku: 456, custo_ultima_compra: 77.22, data_ultima_compra: new Date('2025-06-11'), origem_custo: 'ESTOQUELOG' },
    ];
    db.query.mockResolvedValue(mockRows);
    db.runQuery.mockResolvedValue(mockRows);
    const res = await request(app)
      .get('/api/v1/estoque/ultimo-custo')
      .query({ empresa: '18' });
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({
      cod_sku: 456,
      custo_ultima_compra: 77.22,
      origem_custo: 'ESTOQUELOG',
    });
  });

  it('caso NULL: origem_custo=null para SKUs sem qualquer histórico de custo', async () => {
    const mockRows = [
      { cod_sku: 789, custo_ultima_compra: null, data_ultima_compra: null, origem_custo: null },
    ];
    db.query.mockResolvedValue(mockRows);
    db.runQuery.mockResolvedValue(mockRows);
    const res = await request(app)
      .get('/api/v1/estoque/ultimo-custo')
      .query({ empresa: '18' });
    expect(res.status).toBe(200);
    expect(res.body.data[0].custo_ultima_compra).toBeNull();
    expect(res.body.data[0].origem_custo).toBeNull();
  });
});
