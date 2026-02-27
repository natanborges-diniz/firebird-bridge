const request = require('supertest');

jest.mock('../src/db', () => ({
  pingDatabase: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('../src/services/vendasService', () => ({
  getResumoEmpresaVendedor: jest.fn(),
  getFormasPagamentoResumo: jest.fn(),
  getResumoDiarioSimples: jest.fn(),
  getFormasPagamentoAuditoria: jest.fn(),
  getFormasPagamentoAuditoriaLight: jest.fn(),
  debugCreateIndexes: jest.fn(),
  debugResumoEmpresaVendedor: jest.fn(),
  getAnaliseFamiliaVendedor: jest.fn(),
  getAnaliseSku: jest.fn(),
}));

const vendasService = require('../src/services/vendasService');
const app = require('../src/server');

describe('GET /api/v1/vendas/resumo-formas-pagamento', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('propaga incluirDevolucoes=true para o service', async () => {
    vendasService.getFormasPagamentoResumo.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/vendas/resumo-formas-pagamento').query({
      empresa: 'ALL',
      dataInicio: '2026-01-30',
      dataFim: '2026-02-27',
      cache: '0',
      incluirDevolucoes: 'true',
    });

    expect(res.status).toBe(200);
    expect(vendasService.getFormasPagamentoResumo).toHaveBeenCalledWith(
      expect.objectContaining({
        empresa: 'ALL',
        dataInicio: '2026-01-30',
        dataFim: '2026-02-27',
        incluirDevolucoes: true,
        useCache: false,
      })
    );
  });
});
