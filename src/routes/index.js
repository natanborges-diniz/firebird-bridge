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

// ============================================
// CONSTANTES DE NEGÓCIO
// ============================================

// Empresas que não devem aparecer nos filtros (lixo ou sem operação)
const EMPRESAS_EXCLUIDAS = [3, 5, 7, 8, 10, 11, 12];

// Empresas que devem ser unificadas (18 -> 13 = DINIZ SUPER)
const EMPRESAS_UNIFICADAS = { 18: 13 };

// Helper para obter cláusula WHERE de empresas ativas
function getWhereEmpresasAtivas(alias = 'e') {
  return `${alias}.codempresa NOT IN (${EMPRESAS_EXCLUIDAS.join(',')})`;
}

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

// Função para criar resposta padronizada
function apiResponse(res, data, error = null) {
  if (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      ok: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || 'Erro inesperado no servidor',
        details: null
      }
    });
  }
  return res.json({
    ok: true,
    data: data,
    error: null
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// API v1 - Empresas (com filtro de ativas)
// ============================================
app.get('/api/v1/empresas', async (req, res) => {
  try {
    const sql = `
      SELECT 
        CODEMPRESA AS cod_empresa, 
        NOMEFANTASIA AS empresa_nome,
        CODEMPRESA AS empresa_cod_logico,
        NOMEFANTASIA AS empresa_nome_logico
      FROM EMPRESA
      WHERE ATIVO = 1
        AND ${getWhereEmpresasAtivas('EMPRESA')}
      ORDER BY NOMEFANTASIA
    `;
    
    console.log('[API] GET /api/v1/empresas');
    const rows = await executeQuery(sql);
    
    // Aplicar unificação de empresas (18 -> 13)
    const empresasMap = new Map();
    for (const row of rows) {
      const codLogico = EMPRESAS_UNIFICADAS[row.COD_EMPRESA] || row.COD_EMPRESA;
      if (!empresasMap.has(codLogico)) {
        empresasMap.set(codLogico, {
          cod_empresa: codLogico,
          empresa_nome: row.EMPRESA_NOME,
          empresa_cod_logico: codLogico,
          empresa_nome_logico: row.EMPRESA_NOME_LOGICO
        });
      }
    }
    
    const empresas = Array.from(empresasMap.values()).sort((a, b) => 
      a.empresa_nome.localeCompare(b.empresa_nome)
    );
    
    return apiResponse(res, empresas);
  } catch (error) {
    return apiResponse(res, null, error);
  }
});

// ============================================
// API v1 - Parcelas Financeiras (suporta empresa=null para TODAS)
// ============================================
app.get('/api/v1/financeiro/parcelas', async (req, res) => {
  try {
    const { dataInicio, dataFim, empresa, tipo, situacao, campoData } = req.query;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({ 
        ok: false, 
        data: null,
        error: { code: 'INVALID_PARAMS', message: 'Parâmetros obrigatórios: dataInicio, dataFim' }
      });
    }

    // Determinar campo de data para filtro
    const campoDataMap = {
      'EMISSAO': 'fl.dataemissao',
      'VENCIMENTO': 'fp.datavencimento',
      'PAGAMENTO': 'fp.datapagamento'
    };
    const campoDataField = campoDataMap[campoData] || campoDataMap['VENCIMENTO'];

    // Montar WHERE base
    let whereClauses = [
      `${campoDataField} >= '${dataInicio}'`,
      `${campoDataField} <= '${dataFim}'`,
      getWhereEmpresasAtivas('e')
    ];

    // Filtro de empresa (se informado e não for "null", "TODAS" ou vazio)
    if (empresa && empresa !== 'null' && empresa !== 'TODAS' && empresa !== '') {
      whereClauses.push(`e.codempresa = ${parseInt(empresa)}`);
    }

    // Filtro de tipo (PAGAR / RECEBER)
    if (tipo === 'PAGAR') {
      whereClauses.push("fl.pagar = 'T'");
    } else if (tipo === 'RECEBER') {
      whereClauses.push("fl.pagar = 'F'");
    }

    // Filtro de situação (calculada)
    if (situacao === 'PAGA') {
      whereClauses.push('fp.datapagamento IS NOT NULL');
    } else if (situacao === 'EM ATRASO') {
      whereClauses.push('fp.datapagamento IS NULL');
      whereClauses.push('fp.datavencimento < CURRENT_DATE');
    } else if (situacao === 'EM ABERTO') {
      whereClauses.push('fp.datapagamento IS NULL');
      whereClauses.push('fp.datavencimento >= CURRENT_DATE');
    }

    const whereSQL = whereClauses.join(' AND ');

    const sql = `
      SELECT
        e.codempresa AS cod_empresa,
        e.nomefantasia AS empresa_nome,
        fl.idfinlancamento AS cod_lancamento,
        fl.pagar AS lancamento_pagar,
        fl.previsao AS lancamento_previsao,
        fl.documento AS lancamento_documento,
        p.codpessoa AS pessoa_cod_pessoa,
        p.nome AS pessoa_nome,
        fp.idfinlancamentoparcela AS parcela_id,
        fl.dataemissao AS parcela_data_emissao,
        fp.datavencimento AS parcela_data_vencimento,
        fp.datapagamento AS parcela_data_pagamento,
        fp.datarecebimento AS parcela_data_recebimento,
        fp.valor AS parcela_valor,
        fp.valororiginal AS parcela_valor_original,
        COALESCE(fp.valorpago, 0) AS parcela_valor_pago,
        CASE
          WHEN fp.datapagamento IS NOT NULL THEN 'PAGA'
          WHEN fp.datavencimento < CURRENT_DATE THEN 'EM ATRASO'
          ELSE 'EM ABERTO'
        END AS parcela_situacao,
        cc.idfincontaclassificacao AS contacla_codigo,
        cc.numero AS contacla_numero,
        cc.descricao AS contacla_descricao,
        fpg.idformapagamento AS formapagto_codigo,
        fpt.idformapagamentotipo AS formapagto_tipo_codigo,
        fpt.descricao AS formapagto_tipo_nome
      FROM finlancamento fl
      INNER JOIN finlancamentoparcela fp ON fp.idfinlancamento = fl.idfinlancamento
      INNER JOIN empresa e ON e.codempresa = fl.codempresa
      LEFT JOIN pessoa p ON p.codpessoa = fl.codpessoa
      LEFT JOIN fincontaclassificacao cc ON cc.idfincontaclassificacao = fl.idfincontaclassificacao
      LEFT JOIN formapagamento fpg ON fpg.idformapagamento = fp.idformapagamento
      LEFT JOIN formapagamentotipo fpt ON fpt.idformapagamentotipo = fpg.idformapagamentotipo
      WHERE ${whereSQL}
      ORDER BY fp.datavencimento, fl.idfinlancamento
    `;

    console.log('[API] GET /api/v1/financeiro/parcelas', { empresa: empresa || 'TODAS', dataInicio, dataFim });
    const rows = await executeQuery(sql);
    return apiResponse(res, rows);
  } catch (error) {
    return apiResponse(res, null, error);
  }
});

// ============================================
// API v1 - DRE Gerencial (suporta empresa=null para TODAS)
// ============================================
app.get('/api/v1/financeiro/dre', async (req, res) => {
  try {
    const { dataInicio, dataFim, empresa } = req.query;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({ 
        ok: false, 
        data: null,
        error: { code: 'INVALID_PARAMS', message: 'Parâmetros obrigatórios: dataInicio, dataFim' }
      });
    }

    // Montar WHERE
    let whereClauses = [
      `fp.datavencimento >= '${dataInicio}'`,
      `fp.datavencimento <= '${dataFim}'`,
      getWhereEmpresasAtivas('e')
    ];

    // Filtro de empresa (se informado e não for "null", "TODAS" ou vazio)
    if (empresa && empresa !== 'null' && empresa !== 'TODAS' && empresa !== '') {
      whereClauses.push(`e.codempresa = ${parseInt(empresa)}`);
    }

    const whereSQL = whereClauses.join(' AND ');

    const sql = `
      SELECT
        EXTRACT(YEAR FROM fp.datavencimento) || '-' || LPAD(EXTRACT(MONTH FROM fp.datavencimento), 2, '0') AS COMPETENCIA,
        e.codempresa AS COD_EMPRESA,
        e.nomefantasia AS EMPRESA_NOME,
        cc.idfincontaclassificacao AS CONTACLA_CODIGO,
        cc.numero AS CONTACLA_NUMERO,
        cc.descricao AS CONTACLA_DESCRICAO,
        SUM(CASE WHEN fl.pagar = 'T' THEN -fp.valor ELSE fp.valor END) AS VALOR_TOTAL
      FROM finlancamento fl
      INNER JOIN finlancamentoparcela fp ON fp.idfinlancamento = fl.idfinlancamento
      INNER JOIN empresa e ON e.codempresa = fl.codempresa
      LEFT JOIN fincontaclassificacao cc ON cc.idfincontaclassificacao = fl.idfincontaclassificacao
      WHERE ${whereSQL}
      GROUP BY
        EXTRACT(YEAR FROM fp.datavencimento) || '-' || LPAD(EXTRACT(MONTH FROM fp.datavencimento), 2, '0'),
        e.codempresa, e.nomefantasia,
        cc.idfincontaclassificacao, cc.numero, cc.descricao
      ORDER BY COMPETENCIA, cc.numero
    `;

    console.log('[API] GET /api/v1/financeiro/dre', { empresa: empresa || 'TODAS', dataInicio, dataFim });
    const rows = await executeQuery(sql);
    return apiResponse(res, rows);
  } catch (error) {
    return apiResponse(res, null, error);
  }
});

// ============================================
// API Debug - Schema de Tabelas (temporário)
// ============================================
app.get('/api/debug/schema/:tabela', async (req, res) => {
  try {
    const { tabela } = req.params;
    
    // Lista de tabelas permitidas (segurança)
    const tabelasPermitidas = [
      'FINLANCAMENTO', 
      'FINLANCAMENTOPARCELA', 
      'FINCONTACLASSIFICACAO',
      'PESSOA',
      'EMPRESA',
      'TRANSACAO',
      'TRANSACAO_ITEM'
    ];
    
    const tabelaUpper = tabela.toUpperCase();
    
    if (!tabelasPermitidas.includes(tabelaUpper)) {
      return res.status(400).json({
        ok: false,
        error: { 
          message: `Tabela não permitida. Use: ${tabelasPermitidas.join(', ')}` 
        }
      });
    }
    
    // Query nos metadados do Firebird
    const sql = `
      SELECT 
        rf.RDB$FIELD_NAME AS campo,
        rf.RDB$FIELD_POSITION AS posicao,
        f.RDB$FIELD_TYPE AS tipo_codigo,
        CASE f.RDB$FIELD_TYPE
          WHEN 7 THEN 'SMALLINT'
          WHEN 8 THEN 'INTEGER'
          WHEN 10 THEN 'FLOAT'
          WHEN 12 THEN 'DATE'
          WHEN 13 THEN 'TIME'
          WHEN 14 THEN 'CHAR'
          WHEN 16 THEN 'BIGINT'
          WHEN 27 THEN 'DOUBLE'
          WHEN 35 THEN 'TIMESTAMP'
          WHEN 37 THEN 'VARCHAR'
          WHEN 261 THEN 'BLOB'
          ELSE 'OUTRO'
        END AS tipo_nome,
        f.RDB$FIELD_LENGTH AS tamanho,
        rf.RDB$NULL_FLAG AS not_null
      FROM RDB$RELATION_FIELDS rf
      INNER JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE
      WHERE rf.RDB$RELATION_NAME = '${tabelaUpper}'
      ORDER BY rf.RDB$FIELD_POSITION
    `;
    
    console.log('[DEBUG] Schema da tabela:', tabelaUpper);
    const rows = await executeQuery(sql);
    
    // Formatar resultado
    const campos = rows.map(row => ({
      campo: row.CAMPO?.trim(),
      posicao: row.POSICAO,
      tipo: row.TIPO_NOME,
      tamanho: row.TAMANHO,
      notNull: row.NOT_NULL === 1
    }));
    
    // Destacar campos que parecem ser de data de alteração
    const camposAlteracao = campos.filter(c => 
      c.campo?.toLowerCase().includes('alteracao') ||
      c.campo?.toLowerCase().includes('alterado') ||
      c.campo?.toLowerCase().includes('modificado') ||
      c.campo?.toLowerCase().includes('updated') ||
      c.campo?.toLowerCase().includes('modificacao')
    );
    
    return res.json({
      ok: true,
      tabela: tabelaUpper,
      totalCampos: campos.length,
      camposAlteracao: camposAlteracao.length > 0 ? camposAlteracao : 'Nenhum campo de alteração encontrado',
      campos: campos
    });
  } catch (error) {
    console.error('Erro /api/debug/schema:', error);
    return res.status(500).json({
      ok: false,
      error: { message: error.message }
    });
  }
});

// ============================================
// ENDPOINTS LEGADOS (mantidos para compatibilidade)
// ============================================

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

// Lista de empresas/lojas (legado)
app.get('/api/empresas', async (req, res) => {
  try {
    const sql = `
      SELECT CODEMPRESA as cod_empresa, NOMEFANTASIA as nome_fantasia, CIDADE, UF
      FROM EMPRESA
      WHERE ATIVO = 1
      ORDER BY NOMEFANTASIA
    `;
    
    const result = await executeQuery(sql);
    res.json(result.map(row => ({
      codEmpresa: row.COD_EMPRESA,
      nomeFantasia: row.NOME_FANTASIA,
      cidade: row.CIDADE,
      uf: row.UF
    })));
  } catch (error) {
    console.error('Erro /api/empresas:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Firebird Bridge rodando na porta ${PORT}`);
  console.log(`Empresas excluídas: ${EMPRESAS_EXCLUIDAS.join(', ')}`);
});
