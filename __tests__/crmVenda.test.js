const request = require('supertest');

jest.mock('../src/db', () => ({
  query: jest.fn(),
  pingDatabase: jest.fn().mockResolvedValue({ ok: true }),
}));

const db = require('../src/db');
const app = require('../src/server');

// Seletores de tipo de query
// isOsLookup: SELECT FIRST 1 + FROM ordemservicocaixa (lookup de fallback)
// isOsDetail: FROM ordemservicocaixa … JOIN pessoa  (query de detalhe, sem FIRST 1)
const isProbe       = (sql) => /rdb\$relation_fields\s+rf/i.test(sql);
const isVendaLookup = (sql) => /from\s+venda\s+v/i.test(sql);
const isOsLookup    = (sql) => /SELECT\s+FIRST\s+1/i.test(sql) && /from\s+ordemservicocaixa/i.test(sql);
const isOsDetail    = (sql) => /from\s+ordemservicocaixa\s+ocx/i.test(sql) && !/SELECT\s+FIRST\s+1/i.test(sql);

/** OS de exemplo retornada pela query de detalhe. */
const OS_ENTREGUE = {
  os_numero:      97646,
  classificacao:  'producao',
  passou_pronto:  1,
  data_pronto:    '2026-05-28',
  data_entrega:   '2026-05-29',
  cpf:            '12345678901',
  produto:        'ARMACAO MODELO X',
  devolvida:      0,
  is_garantia:    0,
};

const OS_EM_LAB = {
  os_numero:      97647,
  classificacao:  'producao',
  passou_pronto:  0,
  data_pronto:    null,
  data_entrega:   null,
  cpf:            '98765432100',
  produto:        'LENTE PROGRESSIVE',
  devolvida:      0,
  is_garantia:    0,
};

const OS_DEVOLVIDA = {
  os_numero:      97648,
  classificacao:  'producao',
  passou_pronto:  1,
  data_pronto:    '2026-05-28',
  data_entrega:   '2026-05-30',
  cpf:            '11122233344',
  produto:        'ARMACAO DEVOLVIDA',
  devolvida:      1,
  is_garantia:    0,
};

const OS_GARANTIA = {
  os_numero:      97649,
  classificacao:  'imediata',
  passou_pronto:  0,
  data_pronto:    null,
  data_entrega:   '2026-05-31',
  cpf:            '55566677788',
  produto:        'SERVICO GARANTIA',
  devolvida:      0,
  is_garantia:    1,
};

/**
 * Monta o mock completo para um fluxo de getVenda.
 *
 * Sequência de db.query esperada:
 *   1) VENDA lookup (ou OS lookup de fallback)
 *   2) hasColumn DATANASCIMENTO  } em Promise.all
 *   3) hasColumn VENDAGARANTIA_ITEM } em Promise.all
 *   4) OS detail query
 */
function mockVendaFlow({
  vendaRow = null,
  osLookupRow = null,
  temNascimento = false,
  temGarantia = true,
  osRows = [],
} = {}) {
  db.query.mockImplementation((sql, params = []) => {
    if (isProbe(sql)) {
      const tabela = String(params[0] || '').toUpperCase();
      const coluna = String(params[1] || '').toUpperCase();
      if (tabela === 'VENDAGARANTIA_ITEM') return Promise.resolve(temGarantia ? [{}] : []);
      if (tabela === 'PESSOA' && coluna === 'DATANASCIMENTO')
        return Promise.resolve(temNascimento ? [{}] : []);
      return Promise.resolve([]);
    }
    if (isVendaLookup(sql)) return Promise.resolve(vendaRow ? [vendaRow] : []);
    if (isOsLookup(sql))    return Promise.resolve(osLookupRow ? [osLookupRow] : []);
    if (isOsDetail(sql))    return Promise.resolve(osRows);
    return Promise.resolve([]);
  });
}

describe('GET /api/v1/crm/venda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  // ── Validação de parâmetros ─────────────────────────────────────────────

  it('retorna 400 sem ?numero=', async () => {
    const res = await request(app).get('/api/v1/crm/venda');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, error: { code: 'INVALID_PARAMS' } });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('retorna 400 com numero não numérico', async () => {
    const res = await request(app).get('/api/v1/crm/venda').query({ numero: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, error: { code: 'INVALID_PARAMS' } });
  });

  it('retorna 400 com empresa não numérica', async () => {
    mockVendaFlow();
    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '1234', empresa: 'xyz' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ ok: false, error: { code: 'INVALID_PARAMS' } });
  });

  // ── Lookup primário por NUMEROVENDA ─────────────────────────────────────

  it('retorna 200 com lista de OS via NUMEROVENDA', async () => {
    mockVendaFlow({
      vendaRow: { cod_venda: 504293, numerovenda: 1234, total: 1417 },
      osRows:   [OS_ENTREGUE, OS_EM_LAB],
    });

    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toMatchObject({
      numerovenda: 1234,
      valor_total: 1417,
    });
    expect(res.body.data.os).toHaveLength(2);
    expect(res.body.data.os[0]).toMatchObject({
      os_numero:      97646,
      classificacao:  'producao',
      passou_pronto:  1,
      data_entrega:   '2026-05-29',
      cpf:            '12345678901',
      devolvida:      0,
      is_garantia:    0,
      entrega_valida: 1,
    });
  });

  it('inclui data_nascimento no payload quando coluna existe', async () => {
    mockVendaFlow({
      vendaRow:     { cod_venda: 504293, numerovenda: 1234, total: 1417 },
      temNascimento: true,
      osRows:       [{ ...OS_ENTREGUE, data_nascimento: '1985-03-15' }],
    });

    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.data.os[0]).toHaveProperty('data_nascimento', '1985-03-15');
  });

  it('filtra por empresa quando fornecida', async () => {
    mockVendaFlow({
      vendaRow: { cod_venda: 504293, numerovenda: 1234, total: 1417 },
      osRows:   [OS_ENTREGUE],
    });

    const res = await request(app)
      .get('/api/v1/crm/venda')
      .query({ numero: '1234', empresa: '1' });

    expect(res.status).toBe(200);
    // confirma que a query de VENDA recebeu o cod_empresa (param [1] = 1)
    const vendaCall = db.query.mock.calls.find(([sql]) => isVendaLookup(sql));
    expect(vendaCall).toBeDefined();
    expect(vendaCall[1][1]).toBe(1); // empresaParam na posição 1
  });

  // ── Fallback por NUMEROORDEMSERVICO ─────────────────────────────────────

  it('usa fallback por NUMEROORDEMSERVICO quando VENDA não encontrada', async () => {
    mockVendaFlow({
      vendaRow:    null,
      osLookupRow: { cod_venda: 504293, total: 1417 },
      osRows:      [OS_ENTREGUE],
    });

    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '97646' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      numerovenda: 97646, // fallback: devolve o numero informado
      valor_total: 1417,
    });
    expect(res.body.data.os).toHaveLength(1);
  });

  // ── Not found ────────────────────────────────────────────────────────────

  it('retorna 404 quando nenhum lookup encontra venda', async () => {
    mockVendaFlow({ vendaRow: null, osLookupRow: null });

    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '9999' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } });
  });

  // ── Schema sem VENDAGARANTIA_ITEM ─────────────────────────────────────

  it('funciona sem tabela VENDAGARANTIA_ITEM (schema antigo)', async () => {
    mockVendaFlow({
      vendaRow:   { cod_venda: 504293, numerovenda: 1234, total: 850 },
      temGarantia: false,
      osRows:     [OS_ENTREGUE],
    });

    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '1234' });
    expect(res.status).toBe(200);
  });

  // ── Flags devolvida / is_garantia / entrega_valida ───────────────────

  it('entrega_valida=0 quando OS está devolvida', async () => {
    mockVendaFlow({
      vendaRow: { cod_venda: 504293, numerovenda: 1234, total: 1000 },
      osRows:   [OS_DEVOLVIDA],
    });

    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.data.os[0]).toMatchObject({
      devolvida:      1,
      is_garantia:    0,
      entrega_valida: 0,
    });
  });

  it('entrega_valida=0 quando OS é garantia', async () => {
    mockVendaFlow({
      vendaRow: { cod_venda: 504293, numerovenda: 1234, total: 0 },
      osRows:   [OS_GARANTIA],
    });

    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.data.os[0]).toMatchObject({
      devolvida:      0,
      is_garantia:    1,
      entrega_valida: 0,
    });
  });

  it('entrega_valida=0 quando data_entrega é null (OS ainda em lab)', async () => {
    mockVendaFlow({
      vendaRow: { cod_venda: 504293, numerovenda: 1234, total: 1417 },
      osRows:   [OS_EM_LAB],
    });

    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.data.os[0]).toMatchObject({
      devolvida:      0,
      is_garantia:    0,
      entrega_valida: 0,
    });
  });

  it('retorna todas as OS da venda incluindo devolvidas e garantias', async () => {
    mockVendaFlow({
      vendaRow: { cod_venda: 504293, numerovenda: 1234, total: 1417 },
      osRows:   [OS_ENTREGUE, OS_DEVOLVIDA, OS_GARANTIA, OS_EM_LAB],
    });

    const res = await request(app).get('/api/v1/crm/venda').query({ numero: '1234' });

    expect(res.status).toBe(200);
    expect(res.body.data.os).toHaveLength(4);

    const [entregue, devolvida, garantia, emLab] = res.body.data.os;
    expect(entregue.entrega_valida).toBe(1);
    expect(devolvida.entrega_valida).toBe(0);
    expect(garantia.entrega_valida).toBe(0);
    expect(emLab.entrega_valida).toBe(0);
  });
});
