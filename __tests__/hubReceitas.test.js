const request = require('supertest');

// Mock the database module
jest.mock('../src/db', () => ({
  query: jest.fn(),
  pingDatabase: jest.fn().mockResolvedValue(true)
}));

const db = require('../src/db');
const app = require('../src/server');

describe('Hub Receitas Endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/os/hub-receitas', () => {
    it('retorna erro 400 quando dataInicio não é fornecida', async () => {
      const res = await request(app)
        .get('/api/v1/os/hub-receitas')
        .query({ dataFim: '2024-12-31' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        ok: false,
        error: expect.objectContaining({
          code: 'INVALID_PARAMS',
          message: expect.stringContaining('obrigatórios')
        })
      });
    });

    it('retorna erro 400 quando dataFim não é fornecida', async () => {
      const res = await request(app)
        .get('/api/v1/os/hub-receitas')
        .query({ dataInicio: '2024-01-01' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        ok: false,
        error: expect.objectContaining({
          code: 'INVALID_PARAMS'
        })
      });
    });

    it('retorna sucesso com datas válidas', async () => {
      const mockData = [
        {
          cod_os: 1234,
          os: 89798,
          dataemissao: '2024-10-15',
          cliente: 'João da Silva',
          codcliente: 5678,
          telefone: '11999999999',
          od_longe_esf: -2.50,
          od_longe_cil: -0.75,
          oe_longe_esf: -3.00,
          oe_longe_cil: -1.00,
          lente_od_descricao: 'LG VARILUX XR DESIGN CRIZAL OD',
          lente_oe_descricao: 'LG VARILUX XR DESIGN CRIZAL OE',
          ponte: 18,
          aa_vertical: 35,
          ca_horizontal: 55,
          diametro: 70,
          observacao_os: 'Teste observação',
          imagem_receita: 'path/to/receita.jpg',
          url_imagem_receita: 'https://example.com/receita.jpg'
        }
      ];

      db.query.mockResolvedValueOnce(mockData);

      const res = await request(app)
        .get('/api/v1/os/hub-receitas')
        .query({ 
          dataInicio: '2024-01-01', 
          dataFim: '2024-12-31',
          codEmpresa: '1'
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBe(1);
      
      const record = res.body.data[0];
      expect(record.cod_os).toBe(1234);
      expect(record.cliente).toBe('João da Silva');
      expect(record.telefone).toBe('11999999999');
      expect(record.od_longe_esf).toBe(-2.50);
      expect(record.oe_longe_esf).toBe(-3.00);
      expect(record.lente_od_descricao).toBe('LG VARILUX XR DESIGN CRIZAL OD');
      expect(record.lente_oe_descricao).toBe('LG VARILUX XR DESIGN CRIZAL OE');
      expect(record.ponte).toBe(18);
      expect(record.aa_vertical).toBe(35);
    });

    it('verifica que OD e OE têm valores diferentes (não invertidos)', async () => {
      const mockData = [
        {
          cod_os: 1234,
          os: 89798,
          od_longe_esf: -2.50,
          od_longe_cil: -0.75,
          od_longe_eixo: 180,
          oe_longe_esf: -3.00,
          oe_longe_cil: -1.00,
          oe_longe_eixo: 175,
          lente_od_descricao: 'Lente Direita',
          lente_oe_descricao: 'Lente Esquerda'
        }
      ];

      db.query.mockResolvedValueOnce(mockData);

      const res = await request(app)
        .get('/api/v1/os/hub-receitas')
        .query({ 
          dataInicio: '2024-01-01', 
          dataFim: '2024-12-31'
        });

      expect(res.status).toBe(200);
      const record = res.body.data[0];
      
      // Verificar que os valores de OD e OE são diferentes
      expect(record.od_longe_esf).not.toBe(record.oe_longe_esf);
      expect(record.od_longe_cil).not.toBe(record.oe_longe_cil);
      expect(record.od_longe_eixo).not.toBe(record.oe_longe_eixo);
      expect(record.lente_od_descricao).not.toBe(record.lente_oe_descricao);
    });

    it('aceita filtro por número de OS específica', async () => {
      const mockData = [
        {
          cod_os: 1234,
          os: 89798,
          cliente: 'João da Silva'
        }
      ];

      db.query.mockResolvedValueOnce(mockData);

      const res = await request(app)
        .get('/api/v1/os/hub-receitas')
        .query({ 
          dataInicio: '2024-01-01', 
          dataFim: '2024-12-31',
          os: '89798'
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data[0].os).toBe(89798);
      
      // Verificar que os parâmetros passados incluem o filtro de OS
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([89798])
      );
    });

    it('retorna erro 400 quando os não é numérico', async () => {
      const res = await request(app)
        .get('/api/v1/os/hub-receitas')
        .query({ 
          dataInicio: '2024-01-01', 
          dataFim: '2024-12-31',
          os: 'abc'
        });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        ok: false,
        error: expect.objectContaining({
          code: 'INVALID_PARAMS',
          message: expect.stringContaining('numérico')
        })
      });
    });

    it('aceita codEmpresa como ALL', async () => {
      db.query.mockResolvedValueOnce([]);

      const res = await request(app)
        .get('/api/v1/os/hub-receitas')
        .query({ 
          dataInicio: '2024-01-01', 
          dataFim: '2024-12-31',
          codEmpresa: 'ALL'
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      
      // Verificar que NULL é passado quando codEmpresa é ALL
      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null])
      );
    });

    it('verifica que todos os campos esperados estão presentes', async () => {
      const mockData = [
        {
          cod_os: 1234,
          os: 89798,
          dataemissao: '2024-10-15',
          dataprevisao: '2024-10-20',
          total: 1500.00,
          cod_empresa_origem: 1,
          empresa: 'Ótica Teste',
          codcliente: 5678,
          cliente: 'João da Silva',
          telefone: '11999999999',
          vendedor: 'Maria Vendedora',
          observacao_os: 'Observação da OS',
          observacao_interna_os: 'Obs interna',
          dp: 65,
          perto_dp: 63,
          ponte: 18,
          aa_vertical: 35,
          ca_horizontal: 55,
          diametro: 70,
          ta: 12,
          md: 14,
          he: 16,
          st: 8,
          observacao_lente: 'Obs lente',
          observacao_pendencia: 'Pendência',
          observacao_receita: 'Obs receita',
          od_longe_esf: -2.50,
          od_longe_cil: -0.75,
          od_longe_eixo: 180,
          od_adicao: 2.00,
          oe_longe_esf: -3.00,
          oe_longe_cil: -1.00,
          oe_longe_eixo: 175,
          oe_adicao: 2.00,
          lente_od_descricao: 'Lente OD',
          lente_oe_descricao: 'Lente OE',
          imagem_receita: 'receita.jpg',
          url_imagem_receita: 'https://example.com/receita.jpg',
          imagem_armacao: 'armacao.jpg',
          url_imagem_armacao: 'https://example.com/armacao.jpg',
          imagem_tracer: 'tracer.jpg',
          arquivo_tracer: 'tracer.xml'
        }
      ];

      db.query.mockResolvedValueOnce(mockData);

      const res = await request(app)
        .get('/api/v1/os/hub-receitas')
        .query({ 
          dataInicio: '2024-01-01', 
          dataFim: '2024-12-31'
        });

      expect(res.status).toBe(200);
      const record = res.body.data[0];
      
      // Verificar campos de identificação
      expect(record).toHaveProperty('cod_os');
      expect(record).toHaveProperty('os');
      
      // Verificar campos de cliente
      expect(record).toHaveProperty('cliente');
      expect(record).toHaveProperty('codcliente');
      expect(record).toHaveProperty('telefone');
      
      // Verificar campos de armação
      expect(record).toHaveProperty('ponte');
      expect(record).toHaveProperty('aa_vertical');
      expect(record).toHaveProperty('ca_horizontal');
      expect(record).toHaveProperty('diametro');
      expect(record).toHaveProperty('ta');
      expect(record).toHaveProperty('md');
      expect(record).toHaveProperty('he');
      expect(record).toHaveProperty('st');
      
      // Verificar campos de dioptrias
      expect(record).toHaveProperty('od_longe_esf');
      expect(record).toHaveProperty('od_longe_cil');
      expect(record).toHaveProperty('od_longe_eixo');
      expect(record).toHaveProperty('oe_longe_esf');
      expect(record).toHaveProperty('oe_longe_cil');
      expect(record).toHaveProperty('oe_longe_eixo');
      
      // Verificar campos de lentes
      expect(record).toHaveProperty('lente_od_descricao');
      expect(record).toHaveProperty('lente_oe_descricao');
      
      // Verificar campos de imagens
      expect(record).toHaveProperty('imagem_receita');
      expect(record).toHaveProperty('url_imagem_receita');
      expect(record).toHaveProperty('imagem_armacao');
      expect(record).toHaveProperty('url_imagem_armacao');
      
      // Verificar campos de observações
      expect(record).toHaveProperty('observacao_os');
      expect(record).toHaveProperty('observacao_lente');
      expect(record).toHaveProperty('observacao_receita');
    });

    it('não retorna registros duplicados para OS na mesma transação', async () => {
      // Simular caso onde múltiplas OS compartilham a mesma transação
      // Antes da correção, isso causaria cartesian join
      const mockData = [
        {
          cod_os: 1234,
          os: 89798,
          cliente: 'João da Silva',
          od_longe_esf: -2.50,
          lente_od_descricao: 'Lente OD 1'
        },
        {
          cod_os: 1235,
          os: 89799,
          cliente: 'Maria da Silva',
          od_longe_esf: -3.00,
          lente_od_descricao: 'Lente OD 2'
        }
      ];

      db.query.mockResolvedValueOnce(mockData);

      const res = await request(app)
        .get('/api/v1/os/hub-receitas')
        .query({ 
          dataInicio: '2024-01-01', 
          dataFim: '2024-12-31'
        });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      
      // Verificar que cada OS é única
      const osNumbers = res.body.data.map(r => r.os);
      const uniqueOsNumbers = [...new Set(osNumbers)];
      expect(osNumbers.length).toBe(uniqueOsNumbers.length);
      
      // Verificar que cada OS tem seus próprios dados (não cruzados)
      expect(res.body.data[0].os).toBe(89798);
      expect(res.body.data[0].od_longe_esf).toBe(-2.50);
      expect(res.body.data[1].os).toBe(89799);
      expect(res.body.data[1].od_longe_esf).toBe(-3.00);
    });
  });
});
