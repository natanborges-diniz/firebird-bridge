jest.mock('../src/db', () => ({
  runQuery: jest.fn(),
  // usado pela introspecção de schema (hasColumn) do filtro de venda regular
  query: jest.fn().mockResolvedValue([{ constant: 1 }]),
}));

jest.mock('../src/utils/queryCache', () => ({
  DEFAULT_TTL_MS: 120000,
  getCachedOrFetch: jest.fn(),
  getCachedEntry: jest.fn(),
  getRangeTtlMs: jest.fn(() => 120000),
  setCachedValue: jest.fn(),
}));

const db = require('../src/db');
const queryCache = require('../src/utils/queryCache');
const vendasService = require('../src/services/vendasService');

describe('vendasService.getFormasPagamentoResumo', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCache.getCachedOrFetch.mockImplementation(({ fetcher }) => fetcher());
  });

  it('retorna cache stale agregado quando todas as empresas falham', async () => {
    db.runQuery.mockRejectedValue(new Error('firebird timeout'));

    const staleRows = [{ FORMAPAGAMENTO: 'PIX', TOTAL: 123 }];
    queryCache.getCachedEntry.mockImplementation(({ label }) => {
      if (label === 'vendas.formas_pagamento_resumo.all_empresas') {
        return {
          value: staleRows,
          createdAt: Date.now() - 1000,
          expiresAt: Date.now() - 500,
        };
      }
      return null;
    });

    const result = await vendasService.getFormasPagamentoResumo({
      empresa: 'ALL',
      dataInicio: '2026-01-30',
      dataFim: '2026-02-27',
      excluirCreditos: false,
      incluirDevolucoes: true,
      useCache: false,
    });

    expect(result.rows).toEqual(staleRows);
    // caminho de cache stale antecipado: nenhuma empresa foi consultada,
    // logo nao ha falhas por empresa a reportar
    expect(result.empresasComErro).toEqual([]);
    expect(queryCache.getCachedEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'vendas.formas_pagamento_resumo.all_empresas',
        allowExpired: true,
      })
    );
  });

  it('normaliza chave de cache agregado para empresa=ALL', async () => {
    db.runQuery.mockRejectedValue(new Error('firebird timeout'));

    const staleRows = [{ FORMAPAGAMENTO: 'CREDITO', TOTAL: 99 }];
    queryCache.getCachedEntry.mockImplementation(({ label, params }) => {
      if (
        label === 'vendas.formas_pagamento_resumo.all_empresas' &&
        Array.isArray(params) &&
        params[0] === '1,2,4,6,9,13,14,15,16,17'
      ) {
        return {
          value: staleRows,
          createdAt: Date.now() - 1000,
          expiresAt: Date.now() - 500,
        };
      }
      return null;
    });

    const result = await vendasService.getFormasPagamentoResumo({
      empresa: 'ALL',
      dataInicio: '2026-01-30',
      dataFim: '2026-02-27',
      excluirCreditos: false,
      incluirDevolucoes: false,
      useCache: false,
    });

    expect(result.rows).toEqual(staleRows);
    expect(queryCache.getCachedEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'vendas.formas_pagamento_resumo.all_empresas',
        params: ['1,2,4,6,9,13,14,15,16,17', '2026-01-30', '2026-02-27', 0, 0],
        allowExpired: true,
      })
    );
  });
  it('persiste cache agregado quando há dados bem sucedidos', async () => {
    db.runQuery
      .mockResolvedValueOnce([{ FORMAPAGAMENTO: 'PIX' }])
      .mockRejectedValue(new Error('timeout'));

    const result = await vendasService.getFormasPagamentoResumo({
      empresa: '1,2',
      dataInicio: '2026-01-30',
      dataFim: '2026-02-27',
      excluirCreditos: false,
      incluirDevolucoes: true,
      useCache: false,
    });

    expect(result.rows).toEqual([{ FORMAPAGAMENTO: 'PIX' }]);
    // falha parcial visivel (D13): a empresa que falhou e reportada
    expect(result.empresasComErro).toEqual([
      { empresa: 2, erro: expect.stringContaining('timeout') },
    ]);
    expect(queryCache.setCachedValue).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'vendas.formas_pagamento_resumo.all_empresas',
        params: ['1,2', '2026-01-30', '2026-02-27', 0, 1],
        value: [{ FORMAPAGAMENTO: 'PIX' }],
      })
    );
  });
});
