const request = require('supertest');

jest.mock('../src/db', () => ({
  pingDatabase: jest.fn().mockResolvedValue(true)
}));

const app = require('../src/server');

describe('Health check', () => {
  it('retorna ok sem verificar o banco', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ 
      ok: true, 
      data: expect.objectContaining({ 
        status: 'UP', 
        db: 'SKIPPED' 
      })
    });
  });

  it('retorna ok quando checkDb=true', async () => {
    const res = await request(app).get('/api/v1/health').query({ checkDb: 'true' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ 
      ok: true, 
      data: expect.objectContaining({ 
        status: 'UP', 
        db: 'UP' 
      })
    });
  });
});

describe('Validação de parâmetros nas rotas', () => {
  it('financeiro/parcelas exige parâmetros obrigatórios', async () => {
    const res = await request(app).get('/api/v1/financeiro/parcelas');

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).toMatch(/Parâmetros obrigatórios/i);
  });
});
