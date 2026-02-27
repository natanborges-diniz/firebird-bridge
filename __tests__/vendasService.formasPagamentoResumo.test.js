jest.mock('../src/db', () => ({
  runQuery: jest.fn(),
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

    const rows = await vendasService.getFormasPagamentoResumo({
      empresa: 'ALL',
      dataInicio: '2026-01-30',
      dataFim: '2026-02-27',
      excluirCreditos: false,
      incluirDevolucoes: true,
      useCache: false,
    });

    expect(rows).toEqual(staleRows);
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

    const rows = await vendasService.getFormasPagamentoResumo({
      empresa: 'ALL',
      dataInicio: '2026-01-30',
      dataFim: '2026-02-27',
      excluirCreditos: false,
      incluirDevolucoes: false,
      useCache: false,
    });

    expect(rows).toEqual(staleRows);
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

    const rows = await vendasService.getFormasPagamentoResumo({
      empresa: '1,2',
      dataInicio: '2026-01-30',
      dataFim: '2026-02-27',
      excluirCreditos: false,
      incluirDevolucoes: true,
      useCache: false,
    });

    expect(rows).toEqual([{ FORMAPAGAMENTO: 'PIX' }]);
    expect(queryCache.setCachedValue).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'vendas.formas_pagamento_resumo.all_empresas',
        params: ['1,2', '2026-01-30', '2026-02-27', 0, 1],
        value: [{ FORMAPAGAMENTO: 'PIX' }],
      })
    );
  });
});
