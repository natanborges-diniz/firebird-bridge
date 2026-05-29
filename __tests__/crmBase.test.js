const request = require('supertest');

// Mock do módulo de banco (mesmo padrão de osMetadata.test.js)
jest.mock('../src/db', () => ({
  query: jest.fn(),
  pingDatabase: jest.fn().mockResolvedValue({ ok: true }),
}));

const db = require('../src/db');
const app = require('../src/server');

// A query de introspecção usa o alias "rdb$relation_fields rf"; a query
// de dados consulta "ordemservicocaixa". (A string "rdb$relation_fields"
// também aparece no comentário do SQL de dados, por isso usamos o alias.)
const isProbe = (sql) => /rdb\$relation_fields\s+rf/i.test(sql);
const isDataQuery = (sql) => /from\s+ordemservicocaixa/i.test(sql);

/**
 * Configura o mock de db.query para simular um schema do Firebird.
 * - Chamadas de introspecção (hasColumn) recebem [tabela, coluna] como
 *   params -> respondem [{}] se existir, senão [].
 *   - colunasExistentes: colunas opcionais da tabela PESSOA presentes.
 *   - temGarantia: se a tabela VENDAGARANTIA_ITEM existe (default true).
 * - A query final (dados) recebe [empresa, empresa] -> responde `linhas`.
 */
function mockSchema({ colunasExistentes = [], temGarantia = true, linhas = [] }) {
  const pessoa = new Set(colunasExistentes.map((c) => c.toUpperCase()));
  db.query.mockImplementation((sql, params = []) => {
    if (isProbe(sql)) {
      const tabela = String(params[0] || '').toUpperCase();
      const coluna = String(params[1] || '').toUpperCase();
      if (tabela === 'VENDAGARANTIA_ITEM') {
        return Promise.resolve(temGarantia ? [{}] : []);
      }
      return Promise.resolve(pessoa.has(coluna) ? [{}] : []);
    }
    return Promise.resolve(linhas);
  });
}

/** Retorna o [sql, params] da query de dados (não a de introspecção). */
function getDataQueryCall() {
  return db.query.mock.calls.find(([sql]) => isDataQuery(sql));
}

describe('GET /api/v1/crm/base', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockReset();
  });

  it('retorna 400 quando empresa não é numérica nem ALL', async () => {
    const res = await request(app).get('/api/v1/crm/base').query({ empresa: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: 'INVALID_PARAMS' }),
    });
    // não deve nem tocar no banco
    expect(db.query).not.toHaveBeenCalled();
  });

  it('filtra por empresa e usa colunas verificadas + opcionais existentes', async () => {
    const linhas = [
      {
        cod_cliente: 10,
        cliente: 'FULANO DE TAL',
        cpf: '12345678901',
        telefone_celular: '11999990000',
        telefone_residencial: null,
        telefone_comercial: null,
        email: 'fulano@x.com',
        bairro: 'CENTRO',
      },
    ];
    // schema real: tem EMAIL e BAIRRO, mas NÃO tem ENDERECO/CEP/etc.
    mockSchema({ colunasExistentes: ['EMAIL', 'BAIRRO'], linhas });

    const res = await request(app).get('/api/v1/crm/base').query({ empresa: 1 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual(linhas);

    const [sql, params] = getDataQueryCall();
    // colunas verificadas sempre presentes (com limpeza)
    expect(sql).toMatch(/pc\.cod_pessoa\s+AS cod_cliente/i);
    expect(sql).toMatch(/TRIM\(pc\.nome\)/i);
    // telefones sanitizados (digitos validados)
    expect(sql).toMatch(/telefone_celular/i);
    expect(sql).toMatch(/SIMILAR TO '\[0-9\]\{8,15\}'/i);
    // email sanitizado (formato minimo)
    expect(sql).toMatch(/TRIM\(pc\.email\) LIKE '%@%\.%'/i);
    expect(sql).toMatch(/AS email/i);
    // bairro com TRIM/NULLIF
    expect(sql).toMatch(/NULLIF\(TRIM\(pc\.bairro\), ''\) AS bairro/i);
    // opcionais inexistentes NÃO entram
    expect(sql).not.toMatch(/AS endereco/i);
    expect(sql).not.toMatch(/AS cep/i);
    // placeholder foi substituído
    expect(sql).not.toContain('__COLUNAS_OPCIONAIS__');
    // filtro de empresa: dois binds com o mesmo valor
    expect(params).toEqual([1, 1]);
  });

  it('resolve nomes alternativos pelo primeiro candidato existente (LOGRADOURO -> endereco)', async () => {
    mockSchema({ colunasExistentes: ['LOGRADOURO', 'MUNICIPIO'], linhas: [] });

    const res = await request(app).get('/api/v1/crm/base').query({ empresa: 7 });

    expect(res.status).toBe(200);
    const [sql] = getDataQueryCall();
    expect(sql).toMatch(/NULLIF\(TRIM\(pc\.logradouro\), ''\) AS endereco/i);
    expect(sql).toMatch(/NULLIF\(TRIM\(pc\.municipio\), ''\) AS cidade/i);
    expect(sql).not.toMatch(/pc\.endereco/i); // ENDERECO não existe -> usa LOGRADOURO
  });

  it('aceita empresa=ALL como filtro nulo (todas as empresas)', async () => {
    mockSchema({ colunasExistentes: [], linhas: [] });

    const res = await request(app).get('/api/v1/crm/base').query({ empresa: 'ALL' });

    expect(res.status).toBe(200);
    const [sql, params] = getDataQueryCall();
    expect(params).toEqual([null, null]);
    // sem opcionais, query ainda válida e sem placeholder
    expect(sql).not.toContain('__COLUNAS_OPCIONAIS__');
  });

  it('exclui OS de garantia/reparo quando vendagarantia_item existe', async () => {
    mockSchema({ colunasExistentes: [], temGarantia: true, linhas: [] });

    const res = await request(app).get('/api/v1/crm/base').query({ empresa: 1 });

    expect(res.status).toBe(200);
    const [sql] = getDataQueryCall();
    expect(sql).toMatch(/NOT EXISTS/i);
    expect(sql).toMatch(/from\s+vendagarantia_item/i);
    expect(sql).toMatch(/vgi\.cod_ordemservicocaixa\s*=\s*ocx\.cod_ordemservicocaixa/i);
    expect(sql).not.toContain('__FILTRO_OS_REGULAR__');
  });

  it('mantém a query funcional sem o filtro quando vendagarantia_item não existe', async () => {
    mockSchema({ colunasExistentes: [], temGarantia: false, linhas: [] });

    const res = await request(app).get('/api/v1/crm/base').query({ empresa: 1 });

    expect(res.status).toBe(200);
    const [sql] = getDataQueryCall();
    expect(sql).not.toMatch(/from\s+vendagarantia_item/i);
    expect(sql).not.toContain('__FILTRO_OS_REGULAR__');
  });

  it('deduplica por CPF mantendo o maior cod_cliente e preserva clientes sem CPF', async () => {
    const linhas = [
      { cod_cliente: 5, cliente: 'FULANO', cpf: '111' },
      { cod_cliente: 9, cliente: 'FULANO (cadastro novo)', cpf: '111' },
      { cod_cliente: 7, cliente: 'SEM CPF A', cpf: null },
      { cod_cliente: 8, cliente: 'SEM CPF B', cpf: '' },
    ];
    mockSchema({ colunasExistentes: [], temGarantia: true, linhas });

    const res = await request(app).get('/api/v1/crm/base').query({ empresa: 1 });

    expect(res.status).toBe(200);
    const data = res.body.data;
    // CPF 111 colapsa para 1 registro (o de maior cod_cliente = 9)
    const cpf111 = data.filter((r) => (r.cpf || '').trim() === '111');
    expect(cpf111).toHaveLength(1);
    expect(cpf111[0].cod_cliente).toBe(9);
    // clientes sem CPF (null e '') são preservados
    expect(data.some((r) => r.cod_cliente === 7)).toBe(true);
    expect(data.some((r) => r.cod_cliente === 8)).toBe(true);
    expect(data).toHaveLength(3);
  });

  it('retorna 500 estruturado quando o banco falha', async () => {
    db.query.mockRejectedValue(new Error('ECONNREFUSED'));

    const res = await request(app).get('/api/v1/crm/base').query({ empresa: 1 });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      ok: false,
      error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
    });
  });
});
