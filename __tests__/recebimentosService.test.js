// __tests__/recebimentosService.test.js
//
// Testes do recebimentosService (Fase 1) com db mockado: fan-out por empresa,
// agregacao para o sync diario, empresasComErro (D13) e fallback gracioso das
// devolucoes quando o schema nao tem as tabelas/colunas da hipotese.
jest.mock('../src/db', () => ({
  runQuery: jest.fn(),
  // usado pela introspeccao de schema (hasColumn/hasTable)
  query: jest.fn(),
}));

jest.mock('../src/utils/queryCache', () => ({
  getCachedOrFetch: jest.fn(),
}));

const db = require('../src/db');
const queryCache = require('../src/utils/queryCache');
const recebimentosService = require('../src/services/recebimentosService');

describe('recebimentosService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCache.getCachedOrFetch.mockImplementation(({ fetcher }) => fetcher());
    // schema completo por padrao (vendagarantia_item, entradanotafiscaldevolucao)
    db.query.mockResolvedValue([{ constant: 1 }]);
  });

  describe('getRecebimentosDetalhe', () => {
    it('faz fan-out por empresa e junta as linhas', async () => {
      db.runQuery
        .mockResolvedValueOnce([{ cod_empresa: 1, valor_recebido: 10 }])
        .mockResolvedValueOnce([{ cod_empresa: 2, valor_recebido: 20 }]);

      const result = await recebimentosService.getRecebimentosDetalhe({
        empresa: '1,2',
        dataInicio: '2026-07-20',
        dataFim: '2026-07-26',
        useCache: false,
      });

      expect(db.runQuery).toHaveBeenCalledTimes(2);
      // ordem dos parametros: origem(dataIni), dataIni, dataFim, empresa, empresa
      expect(db.runQuery).toHaveBeenCalledWith(expect.any(String), [
        '2026-07-20',
        '2026-07-20',
        '2026-07-26',
        1,
        1,
      ]);
      expect(result.rows).toEqual([
        { cod_empresa: 1, valor_recebido: 10 },
        { cod_empresa: 2, valor_recebido: 20 },
      ]);
      expect(result.empresasComErro).toEqual([]);
    });

    it('injeta o NOT EXISTS de vendagarantia_item quando a tabela existe', async () => {
      db.runQuery.mockResolvedValue([]);

      await recebimentosService.getRecebimentosDetalhe({
        empresa: '1',
        dataInicio: '2026-07-20',
        dataFim: '2026-07-26',
        useCache: false,
      });

      const sqlExecutado = db.runQuery.mock.calls[0][0];
      expect(sqlExecutado).toContain('vendagarantia_item');
      expect(sqlExecutado).not.toContain('/*__FILTRO_VENDA_REGULAR__*/');
    });

    it('reporta falhas parciais em empresasComErro mantendo dados das demais (D13)', async () => {
      db.runQuery
        .mockResolvedValueOnce([{ cod_empresa: 1, valor_recebido: 10 }])
        .mockRejectedValueOnce(new Error('firebird timeout'));

      const result = await recebimentosService.getRecebimentosDetalhe({
        empresa: '1,2',
        dataInicio: '2026-07-20',
        dataFim: '2026-07-26',
        useCache: false,
      });

      expect(result.rows).toEqual([{ cod_empresa: 1, valor_recebido: 10 }]);
      expect(result.empresasComErro).toEqual([
        { empresa: 2, erro: expect.stringContaining('timeout') },
      ]);
    });
  });

  describe('getRecebimentosAgregado / agregarRecebimentos', () => {
    it('agrupa por (empresa, vendedor, data, categoria, origem) somando valor e contando parcelas', async () => {
      db.runQuery.mockResolvedValueOnce([
        {
          cod_empresa: 1,
          cod_vendedor: 77,
          vendedor_nome: 'MARIA',
          data_pagamento: new Date('2026-07-21T00:00:00Z'),
          forma_categoria: 'AVISTA',
          origem: 'VENDA_PERIODO',
          valor_recebido: 100.5,
        },
        {
          cod_empresa: 1,
          cod_vendedor: 77,
          vendedor_nome: 'MARIA',
          data_pagamento: '2026-07-21',
          forma_categoria: 'AVISTA',
          origem: 'VENDA_PERIODO',
          valor_recebido: 49.5,
        },
        {
          cod_empresa: 1,
          cod_vendedor: 77,
          vendedor_nome: 'MARIA',
          data_pagamento: '2026-07-21',
          forma_categoria: 'CREDIARIO',
          origem: 'SALDO_ANTERIOR',
          valor_recebido: 30,
        },
      ]);

      const result = await recebimentosService.getRecebimentosAgregado({
        empresa: '1',
        dataInicio: '2026-07-20',
        dataFim: '2026-07-26',
        useCache: false,
      });

      expect(result.empresasComErro).toEqual([]);
      expect(result.rows).toEqual([
        {
          cod_empresa: 1,
          cod_vendedor: 77,
          vendedor_nome: 'MARIA',
          data_pagamento: '2026-07-21',
          forma_categoria: 'AVISTA',
          origem: 'VENDA_PERIODO',
          valor_recebido: 150,
          qtd_parcelas: 2,
        },
        {
          cod_empresa: 1,
          cod_vendedor: 77,
          vendedor_nome: 'MARIA',
          data_pagamento: '2026-07-21',
          forma_categoria: 'CREDIARIO',
          origem: 'SALDO_ANTERIOR',
          valor_recebido: 30,
          qtd_parcelas: 1,
        },
      ]);
    });
  });

  describe('getEmitidos', () => {
    it('consulta com parametros dataIni/dataFim/empresa/empresa e injeta o filtro de garantia', async () => {
      db.runQuery.mockResolvedValue([{ cod_transacao: 5, valor_emitido: 200 }]);

      const result = await recebimentosService.getEmitidos({
        empresa: '9',
        dataInicio: '2026-07-20',
        dataFim: '2026-07-26',
        useCache: false,
      });

      expect(db.runQuery).toHaveBeenCalledWith(expect.stringContaining('vendagarantia_item'), [
        '2026-07-20',
        '2026-07-26',
        9,
        9,
      ]);
      expect(result.rows).toEqual([{ cod_transacao: 5, valor_emitido: 200 }]);
    });
  });

  describe('getDevolucoesRestituicao', () => {
    it('retorna vazio (fallback gracioso) quando o schema nao tem a tabela/coluna da hipotese', async () => {
      // hasTable/hasColumn de ENTRADANOTAFISCALDEVOLUCAO respondem vazio
      db.query.mockResolvedValue([]);

      const result = await recebimentosService.getDevolucoesRestituicao({
        empresa: '1',
        dataInicio: '2026-07-20',
        dataFim: '2026-07-26',
        useCache: false,
      });

      expect(result).toEqual({ rows: [], empresasComErro: [] });
      expect(db.runQuery).not.toHaveBeenCalled();
    });

    it('executa o fan-out quando o schema suporta a hipotese', async () => {
      db.query.mockResolvedValue([{ constant: 1 }]);
      db.runQuery.mockResolvedValue([{ cod_transacao: 8, valor_restituido: 50 }]);

      const result = await recebimentosService.getDevolucoesRestituicao({
        empresa: '1',
        dataInicio: '2026-07-20',
        dataFim: '2026-07-26',
        useCache: false,
      });

      expect(db.runQuery).toHaveBeenCalledWith(expect.any(String), [
        '2026-07-20',
        '2026-07-26',
        1,
        1,
      ]);
      expect(result.rows).toEqual([{ cod_transacao: 8, valor_restituido: 50 }]);
    });
  });
});
