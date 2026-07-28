// __tests__/recebimentosController.test.js
//
// Testes das rotas da Fase 1 (dados de recebimento) com o service mockado:
// validacao de params (dataInicio/dataFim obrigatorios, empresa default ALL),
// propagacao para o service e meta.empresasComErro (D13).
const request = require('supertest');

jest.mock('../src/db', () => ({
  pingDatabase: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('../src/services/recebimentosService', () => ({
  getRecebimentosDetalhe: jest.fn(),
  getRecebimentosAgregado: jest.fn(),
  getEmitidos: jest.fn(),
  getDevolucoesRestituicao: jest.fn(),
}));

const recebimentosService = require('../src/services/recebimentosService');
const app = require('../src/server');

describe('rotas /api/v1/vendas (recebimentos - fase 1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /recebimentos exige dataInicio e dataFim (INVALID_PARAMS)', async () => {
    const res = await request(app).get('/api/v1/vendas/recebimentos').query({ empresa: '1' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PARAMS');
    expect(res.body.error.details.missing).toEqual(['dataInicio', 'dataFim']);
    expect(recebimentosService.getRecebimentosDetalhe).not.toHaveBeenCalled();
  });

  it('GET /recebimentos propaga params e usa empresa=ALL como default', async () => {
    recebimentosService.getRecebimentosDetalhe.mockResolvedValue({ rows: [], empresasComErro: [] });

    const res = await request(app).get('/api/v1/vendas/recebimentos').query({
      dataInicio: '2026-07-20',
      dataFim: '2026-07-26',
      cache: '0',
    });

    expect(res.status).toBe(200);
    expect(recebimentosService.getRecebimentosDetalhe).toHaveBeenCalledWith(
      expect.objectContaining({
        empresa: 'ALL',
        dataInicio: '2026-07-20',
        dataFim: '2026-07-26',
        useCache: false,
      })
    );
    expect(res.body).toEqual({ ok: true, data: [], error: null });
  });

  it('GET /recebimentos expoe empresasComErro no meta mantendo ok:true (D13)', async () => {
    recebimentosService.getRecebimentosDetalhe.mockResolvedValue({
      rows: [{ cod_empresa: 1, valor_recebido: 10 }],
      empresasComErro: [{ empresa: 9, erro: 'Timeout after 45000ms' }],
    });

    const res = await request(app).get('/api/v1/vendas/recebimentos').query({
      empresa: 'ALL',
      dataInicio: '2026-07-20',
      dataFim: '2026-07-26',
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toEqual([{ cod_empresa: 1, valor_recebido: 10 }]);
    expect(res.body.meta).toEqual({
      empresasComErro: [{ empresa: 9, erro: 'Timeout after 45000ms' }],
    });
  });

  it('GET /recebimentos/agregado chama getRecebimentosAgregado', async () => {
    recebimentosService.getRecebimentosAgregado.mockResolvedValue({
      rows: [
        {
          cod_empresa: 1,
          cod_vendedor: 77,
          data_pagamento: '2026-07-21',
          forma_categoria: 'AVISTA',
          origem: 'VENDA_PERIODO',
          valor_recebido: 150,
          qtd_parcelas: 2,
        },
      ],
      empresasComErro: [],
    });

    const res = await request(app).get('/api/v1/vendas/recebimentos/agregado').query({
      empresa: '1',
      dataInicio: '2026-07-20',
      dataFim: '2026-07-26',
    });

    expect(res.status).toBe(200);
    expect(recebimentosService.getRecebimentosAgregado).toHaveBeenCalledWith(
      expect.objectContaining({ empresa: '1' })
    );
    expect(res.body.data[0].qtd_parcelas).toBe(2);
    expect(res.body.meta).toBeUndefined();
  });

  it('GET /emitidos chama getEmitidos', async () => {
    recebimentosService.getEmitidos.mockResolvedValue({ rows: [], empresasComErro: [] });

    const res = await request(app).get('/api/v1/vendas/emitidos').query({
      empresa: '1',
      dataInicio: '2026-07-20',
      dataFim: '2026-07-26',
    });

    expect(res.status).toBe(200);
    expect(recebimentosService.getEmitidos).toHaveBeenCalledWith(
      expect.objectContaining({
        empresa: '1',
        dataInicio: '2026-07-20',
        dataFim: '2026-07-26',
        useCache: true,
      })
    );
  });

  it('GET /devolucoes-restituicao chama getDevolucoesRestituicao', async () => {
    recebimentosService.getDevolucoesRestituicao.mockResolvedValue({ rows: [], empresasComErro: [] });

    const res = await request(app).get('/api/v1/vendas/devolucoes-restituicao').query({
      empresa: '1',
      dataInicio: '2026-07-20',
      dataFim: '2026-07-26',
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: [], error: null });
    expect(recebimentosService.getDevolucoesRestituicao).toHaveBeenCalled();
  });
});
