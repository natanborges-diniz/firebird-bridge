const request = require('supertest');

jest.mock('../src/services/osService', () => ({
  getConsultaStatus: jest.fn(),
}));

jest.mock('../src/db', () => ({
  pingDatabase: jest.fn(),
}));

const osService = require('../src/services/osService');
const app = require('../src/server');

describe('GET /api/v1/os/consulta-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna 400 quando nenhum parâmetro é informado', async () => {
    const res = await request(app).get('/api/v1/os/consulta-status');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      ok: false,
      error: {
        code: 'INVALID_PARAMS',
        message: 'Informe cpf ou os',
      },
    });
  });

  it('retorna 400 quando cpf não tem 11 dígitos', async () => {
    const res = await request(app).get('/api/v1/os/consulta-status?cpf=123');

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PARAMS');
    expect(res.body.error.message).toMatch(/cpf deve conter 11 dígitos/i);
  });

  it('retorna 400 quando os não é numérico', async () => {
    const res = await request(app).get('/api/v1/os/consulta-status?os=abc');

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('INVALID_PARAMS');
    expect(res.body.error.message).toMatch(/os deve ser numérico/i);
  });

  it('retorna envelope v2 com meta.count quando consulta por os', async () => {
    osService.getConsultaStatus.mockResolvedValue([
      {
        os: '98765',
        etapa: 'MONTAGEM',
        statusAtraso: 'NO_PRAZO',
        atrasoDias: 0,
        dataPrevisao: '2026-04-22',
        dataEmissao: '2026-04-10',
        dataSaida: null,
        empresa: 'PRIMITIVA I',
        cliente: 'JOÃO DA SILVA',
        vendedor: 'MARIA',
      },
    ]);

    const res = await request(app).get('/api/v1/os/consulta-status?os=98765');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: [
        {
          os: '98765',
          etapa: 'MONTAGEM',
          statusAtraso: 'NO_PRAZO',
          atrasoDias: 0,
          dataPrevisao: '2026-04-22',
          dataEmissao: '2026-04-10',
          dataSaida: null,
          empresa: 'PRIMITIVA I',
          cliente: 'JOÃO DA SILVA',
          vendedor: 'MARIA',
        },
      ],
      meta: { count: 1 },
    });

    expect(osService.getConsultaStatus).toHaveBeenCalledWith({
      os: 98765,
      cpf: null,
    });
  });

  it('aceita cpf formatado e envia só dígitos para o service', async () => {
    osService.getConsultaStatus.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/os/consulta-status?cpf=123.456.789-01');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      data: [],
      meta: { count: 0 },
    });

    expect(osService.getConsultaStatus).toHaveBeenCalledWith({
      os: null,
      cpf: '12345678901',
    });
  });
});
