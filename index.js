const express = require('express');
const cors = require('cors');
const Firebird = require('node-firebird');

const app = express();
app.use(cors());
app.use(express.json());

// Configuração Firebird - usar variáveis de ambiente em produção
const firebaseConfig = {
  host: process.env.FB_HOST || '201.20.35.230',
  port: parseInt(process.env.FB_PORT || '3050'),
  database: process.env.FB_DATABASE || 'E:\\FTPBackup\\Integracao\\SPOSASCO.DATAWEB.CERT',
  user: process.env.FB_USER || 'SYSDBA',
  password: process.env.FB_PASSWORD || 'masterkey',
  lowercase_keys: false,
  role: null,
  pageSize: 4096
};

// Helper para executar queries
function executeQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    Firebird.attach(firebaseConfig, (err, db) => {
      if (err) {
        console.error('Erro conexão:', err);
        return reject(err);
      }
      
      db.query(sql, params, (err, result) => {
        db.detach();
        if (err) {
          console.error('Erro query:', err);
          return reject(err);
        }
        resolve(result || []);
      });
    });
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// DEBUG: Descobrir estrutura das tabelas
app.get('/api/debug/empresa', async (req, res) => {
  try {
    const sql = `SELECT FIRST 5 * FROM EMPRESA`;
    const result = await executeQuery(sql);
    
    // Retorna as colunas encontradas e alguns dados de exemplo
    const columns = result.length > 0 ? Object.keys(result[0]) : [];
    res.json({
      columns,
      sampleData: result,
      totalColumns: columns.length
    });
  } catch (error) {
    console.error('Erro /api/debug/empresa:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Estrutura da tabela TRANSACAO
app.get('/api/debug/transacao', async (req, res) => {
  try {
    const sql = `SELECT FIRST 5 * FROM TRANSACAO`;
    const result = await executeQuery(sql);
    
    const columns = result.length > 0 ? Object.keys(result[0]) : [];
    res.json({
      columns,
      sampleData: result,
      totalColumns: columns.length
    });
  } catch (error) {
    console.error('Erro /api/debug/transacao:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Estrutura da tabela TRANSACAO_ITEM
app.get('/api/debug/transacao-item', async (req, res) => {
  try {
    const sql = `SELECT FIRST 5 * FROM TRANSACAO_ITEM`;
    const result = await executeQuery(sql);
    
    const columns = result.length > 0 ? Object.keys(result[0]) : [];
    res.json({
      columns,
      sampleData: result,
      totalColumns: columns.length
    });
  } catch (error) {
    console.error('Erro /api/debug/transacao-item:', error);
    res.status(500).json({ error: error.message });
  }
});

// DEBUG: Estrutura da tabela NATUREZAOPERACAO
app.get('/api/debug/naturezaoperacao', async (req, res) => {
  try {
    const sql = `SELECT FIRST 5 * FROM NATUREZAOPERACAO`;
    const result = await executeQuery(sql);
    
    const columns = result.length > 0 ? Object.keys(result[0]) : [];
    res.json({
      columns,
      sampleData: result,
      totalColumns: columns.length
    });
  } catch (error) {
    console.error('Erro /api/debug/naturezaoperacao:', error);
    res.status(500).json({ error: error.message });
  }
});

// KPIs do Dashboard - replica a query original
app.get('/api/kpis', async (req, res) => {
  try {
    const { dataInicio, dataFim, codEmpresa } = req.query;
    
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios' });
    }

    let whereEmpresa = '';
    if (codEmpresa) {
      whereEmpresa = `AND t.CODEMPRESA = ${parseInt(codEmpresa)}`;
    }

    const sql = `
      SELECT 
        COUNT(DISTINCT t.IDTRANSACAO) as quantidade_vendas,
        SUM(ti.VALORORIGINAL - COALESCE(ti.VALORDESCONTO, 0) + COALESCE(ti.TOTALIPI, 0)) as faturamento_total,
        COUNT(DISTINCT t.CODEMPRESA) as lojas_ativas
      FROM TRANSACAO t
      INNER JOIN TRANSACAO_ITEM ti ON ti.IDTRANSACAO = t.IDTRANSACAO
      INNER JOIN NATUREZAOPERACAO no ON no.IDNATUREZAOPERACAO = t.IDNATUREZAOPERACAO
      WHERE no.TIPO = 1
        AND t.DATAEMISSAO >= '${dataInicio}'
        AND t.DATAEMISSAO <= '${dataFim}'
        ${whereEmpresa}
    `;

    const result = await executeQuery(sql);
    const row = result[0] || {};
    
    const faturamentoTotal = parseFloat(row.FATURAMENTO_TOTAL || 0);
    const quantidadeVendas = parseInt(row.QUANTIDADE_VENDAS || 0);
    
    res.json({
      faturamentoTotal,
      quantidadeVendas,
      ticketMedio: quantidadeVendas > 0 ? faturamentoTotal / quantidadeVendas : 0,
      lojasAtivas: parseInt(row.LOJAS_ATIVAS || 0)
    });
  } catch (error) {
    console.error('Erro /api/kpis:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vendas por dia - para gráfico de linha
app.get('/api/vendas-por-dia', async (req, res) => {
  try {
    const { dataInicio, dataFim, codEmpresa } = req.query;
    
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios' });
    }

    let whereEmpresa = '';
    if (codEmpresa) {
      whereEmpresa = `AND t.CODEMPRESA = ${parseInt(codEmpresa)}`;
    }

    const sql = `
      SELECT 
        CAST(t.DATAEMISSAO AS DATE) as data,
        SUM(ti.VALORORIGINAL - COALESCE(ti.VALORDESCONTO, 0) + COALESCE(ti.TOTALIPI, 0)) as faturamento
      FROM TRANSACAO t
      INNER JOIN TRANSACAO_ITEM ti ON ti.IDTRANSACAO = t.IDTRANSACAO
      INNER JOIN NATUREZAOPERACAO no ON no.IDNATUREZAOPERACAO = t.IDNATUREZAOPERACAO
      WHERE no.TIPO = 1
        AND t.DATAEMISSAO >= '${dataInicio}'
        AND t.DATAEMISSAO <= '${dataFim}'
        ${whereEmpresa}
      GROUP BY CAST(t.DATAEMISSAO AS DATE)
      ORDER BY 1
    `;

    const result = await executeQuery(sql);
    
    res.json(result.map(row => ({
      data: row.DATA,
      faturamento: parseFloat(row.FATURAMENTO || 0)
    })));
  } catch (error) {
    console.error('Erro /api/vendas-por-dia:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vendas por loja - para gráfico de barras e ranking
app.get('/api/vendas-por-loja', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;
    
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios' });
    }

    const sql = `
      SELECT 
        e.CODEMPRESA as cod_empresa,
        e.NOMEFANTASIA as loja,
        COUNT(DISTINCT t.IDTRANSACAO) as quantidade,
        SUM(ti.VALORORIGINAL - COALESCE(ti.VALORDESCONTO, 0) + COALESCE(ti.TOTALIPI, 0)) as faturamento
      FROM TRANSACAO t
      INNER JOIN TRANSACAO_ITEM ti ON ti.IDTRANSACAO = t.IDTRANSACAO
      INNER JOIN NATUREZAOPERACAO no ON no.IDNATUREZAOPERACAO = t.IDNATUREZAOPERACAO
      INNER JOIN EMPRESA e ON e.CODEMPRESA = t.CODEMPRESA
      WHERE no.TIPO = 1
        AND t.DATAEMISSAO >= '${dataInicio}'
        AND t.DATAEMISSAO <= '${dataFim}'
      GROUP BY e.CODEMPRESA, e.NOMEFANTASIA
      ORDER BY 4 DESC
    `;

    const result = await executeQuery(sql);
    const totalGeral = result.reduce((sum, row) => sum + parseFloat(row.FATURAMENTO || 0), 0);
    
    res.json(result.map(row => {
      const faturamento = parseFloat(row.FATURAMENTO || 0);
      const quantidade = parseInt(row.QUANTIDADE || 0);
      return {
        codEmpresa: row.COD_EMPRESA,
        loja: row.LOJA,
        quantidade,
        faturamento,
        ticketMedio: quantidade > 0 ? faturamento / quantidade : 0,
        percentual: totalGeral > 0 ? (faturamento / totalGeral) * 100 : 0
      };
    }));
  } catch (error) {
    console.error('Erro /api/vendas-por-loja:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lista de empresas/lojas - TEMPORÁRIO com SELECT *
app.get('/api/empresas', async (req, res) => {
  try {
    // Usando SELECT * para descobrir colunas disponíveis
    const sql = `SELECT * FROM EMPRESA ORDER BY NOMEFANTASIA`;
    
    const result = await executeQuery(sql);
    
    // Mapeia dinamicamente baseado nas colunas disponíveis
    res.json(result.map(row => ({
      codEmpresa: row.CODEMPRESA,
      nomeFantasia: row.NOMEFANTASIA,
      // Campos opcionais - só inclui se existirem
      ...(row.CIDADE && { cidade: row.CIDADE }),
      ...(row.UF && { uf: row.UF }),
      ...(row.RAZAOSOCIAL && { razaoSocial: row.RAZAOSOCIAL }),
      ...(row.CNPJ && { cnpj: row.CNPJ })
    })));
  } catch (error) {
    console.error('Erro /api/empresas:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Firebird Bridge rodando na porta ${PORT}`);
});
