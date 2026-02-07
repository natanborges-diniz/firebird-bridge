const request = require('supertest');

// Mock the database module
jest.mock('../src/db', () => ({
  query: jest.fn(),
  pingDatabase: jest.fn().mockResolvedValue(true)
}));

const db = require('../src/db');
const app = require('../src/server');

describe('OS Metadata Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/os/receitas-metadata', () => {
    it('retorna erro 400 quando campos não são fornecidos', async () => {
      const res = await request(app).get('/api/v1/os/receitas-metadata');

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        ok: false,
        error: expect.objectContaining({
          code: 'INVALID_PARAMS',
          message: expect.stringContaining('campo')
        })
      });
    });

    it('retorna erro 400 quando campos está vazio', async () => {
      const res = await request(app)
        .get('/api/v1/os/receitas-metadata')
        .query({ campos: '' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        ok: false,
        error: expect.objectContaining({
          code: 'INVALID_PARAMS'
        })
      });
    });

    it('consulta metadados para campos específicos sem expand', async () => {
      const mockMatches = [
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_TRANSACAO' },
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ITEM' },
        { tabela: 'ORDEMSERVICOCAIXA', campo: 'COD_TRANSACAO' },
        { tabela: 'ORDEMSERVICOCAIXA', campo: 'NUMEROORDEMSERVICO' }
      ];

      db.query.mockResolvedValueOnce(mockMatches);

      const res = await request(app)
        .get('/api/v1/os/receitas-metadata')
        .query({ campos: 'COD_TRANSACAO,COD_ITEM,NUMEROORDEMSERVICO' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(2); // TRANSACAO_ITEM and ORDEMSERVICOCAIXA

      const transacaoItem = res.body.data.find(t => t.tabela === 'TRANSACAO_ITEM');
      expect(transacaoItem).toBeDefined();
      expect(transacaoItem.campos_encontrados).toContain('COD_TRANSACAO');
      expect(transacaoItem.campos_encontrados).toContain('COD_ITEM');
      expect(transacaoItem.chaves_os).toContain('COD_TRANSACAO');

      const ordemServico = res.body.data.find(t => t.tabela === 'ORDEMSERVICOCAIXA');
      expect(ordemServico).toBeDefined();
      expect(ordemServico.campos_encontrados).toContain('COD_TRANSACAO');
      expect(ordemServico.campos_encontrados).toContain('NUMEROORDEMSERVICO');
    });

    it('consulta metadados com expand=1 para incluir todos os campos da tabela', async () => {
      const mockMatches = [
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_TRANSACAO' },
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ITEM' }
      ];

      const mockAllFields = [
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_TRANSACAO' },
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ITEM' },
        { tabela: 'TRANSACAO_ITEM', campo: 'QUANTIDADE' },
        { tabela: 'TRANSACAO_ITEM', campo: 'VALOR_UNITARIO' }
      ];

      db.query
        .mockResolvedValueOnce(mockMatches)
        .mockResolvedValueOnce(mockAllFields);

      const res = await request(app)
        .get('/api/v1/os/receitas-metadata')
        .query({ campos: 'COD_TRANSACAO,COD_ITEM', expand: '1' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);

      const transacaoItem = res.body.data.find(t => t.tabela === 'TRANSACAO_ITEM');
      expect(transacaoItem).toBeDefined();
      expect(transacaoItem.campos_tabela).toBeInstanceOf(Array);
      expect(transacaoItem.campos_tabela).toContain('COD_TRANSACAO');
      expect(transacaoItem.campos_tabela).toContain('COD_ITEM');
      expect(transacaoItem.campos_tabela).toContain('QUANTIDADE');
      expect(transacaoItem.campos_tabela).toContain('VALOR_UNITARIO');
    });

    it('identifica tabelas que possuem chaves de OS', async () => {
      const mockMatches = [
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_TRANSACAO' },
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ORDEMSERVICOCAIXA' },
        { tabela: 'ORDEMSERVICOCAIXA', campo: 'NUMEROORDEMSERVICO' }
      ];

      db.query.mockResolvedValueOnce(mockMatches);

      const res = await request(app)
        .get('/api/v1/os/receitas-metadata')
        .query({ campos: 'COD_TRANSACAO' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const transacaoItem = res.body.data.find(t => t.tabela === 'TRANSACAO_ITEM');
      expect(transacaoItem).toBeDefined();
      expect(transacaoItem.possui_chave_os).toBe(true);
      expect(transacaoItem.chaves_os).toContain('COD_ORDEMSERVICOCAIXA');
      expect(transacaoItem.chaves_os).toContain('COD_TRANSACAO');
    });

    it('aceita expand como string "true"', async () => {
      const mockMatches = [
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ITEM' }
      ];
      const mockAllFields = [
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ITEM' },
        { tabela: 'TRANSACAO_ITEM', campo: 'QUANTIDADE' }
      ];

      db.query
        .mockResolvedValueOnce(mockMatches)
        .mockResolvedValueOnce(mockAllFields);

      const res = await request(app)
        .get('/api/v1/os/receitas-metadata')
        .query({ campos: 'COD_ITEM', expand: 'true' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      const transacaoItem = res.body.data.find(t => t.tabela === 'TRANSACAO_ITEM');
      expect(transacaoItem.campos_tabela).toBeInstanceOf(Array);
    });

    it('verifica se TRANSACAO_ITEM possui COD_ORDEMSERVICOCAIXA', async () => {
      // Este é o caso de uso principal: descobrir se a coluna existe
      const mockMatches = [
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ORDEMSERVICOCAIXA' },
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_TRANSACAO' },
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ITEM' },
        { tabela: 'ORDEMSERVICOCAIXA', campo: 'NUMEROORDEMSERVICO' },
        { tabela: 'ORDEMSERVICOCAIXA', campo: 'COD_ORDEMSERVICOCAIXA' }
      ];

      const mockAllFields = [
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ORDEMSERVICOCAIXA' },
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_TRANSACAO' },
        { tabela: 'TRANSACAO_ITEM', campo: 'COD_ITEM' },
        { tabela: 'TRANSACAO_ITEM', campo: 'QUANTIDADE' },
        { tabela: 'ORDEMSERVICOCAIXA', campo: 'NUMEROORDEMSERVICO' },
        { tabela: 'ORDEMSERVICOCAIXA', campo: 'COD_ORDEMSERVICOCAIXA' },
        { tabela: 'ORDEMSERVICOCAIXA', campo: 'DATAEMISSAO' }
      ];

      db.query
        .mockResolvedValueOnce(mockMatches)
        .mockResolvedValueOnce(mockAllFields);

      const res = await request(app)
        .get('/api/v1/os/receitas-metadata')
        .query({ 
          campos: 'COD_ORDEMSERVICOCAIXA,COD_TRANSACAO,COD_ITEM,NUMEROORDEMSERVICO',
          expand: '1'
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Verificar se TRANSACAO_ITEM tem COD_ORDEMSERVICOCAIXA
      const transacaoItem = res.body.data.find(t => t.tabela === 'TRANSACAO_ITEM');
      expect(transacaoItem).toBeDefined();
      expect(transacaoItem.campos_encontrados).toContain('COD_ORDEMSERVICOCAIXA');
      expect(transacaoItem.chaves_os).toContain('COD_ORDEMSERVICOCAIXA');
      expect(transacaoItem.possui_chave_os).toBe(true);
    });

    it('retorna array vazio quando nenhuma tabela tem os campos solicitados', async () => {
      db.query.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/os/receitas-metadata')
        .query({ campos: 'CAMPO_INEXISTENTE' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('Rotas alternativas do metadata endpoint', () => {
    it('aceita /api/v1/os/receita-metadata (singular)', async () => {
      db.query.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/os/receita-metadata')
        .query({ campos: 'COD_ITEM' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('aceita /api/v1/os/receitas/metadata (com barra)', async () => {
      db.query.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/os/receitas/metadata')
        .query({ campos: 'COD_ITEM' });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });
});
