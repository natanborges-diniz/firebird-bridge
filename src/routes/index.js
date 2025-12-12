// src/routes/index.js

const express = require('express');
const router = express.Router();

const healthController  = require('../controllers/healthController');
const financeiroRoutes  = require('./financeiroRoutes');
const vendasRoutes      = require('./vendasRoutes');
const debugRoutes       = require('./debugRoutes');
const estoqueRoutes     = require('./estoqueRoutes'); // ⬅ novo
const osRoutes          = require('./osRoutes');
const empresaRoutes     = require('./empresaRoutes');

// Health check
router.get('/health', healthController.health);

// Módulo Financeiro
router.use('/financeiro', financeiroRoutes);

// Módulo Vendas
router.use('/vendas', vendasRoutes);

// Debug (apenas para testes)
router.use('/debug', debugRoutes);

// Módulo Estoque
router.use('/estoque', estoqueRoutes);

// Módulo OS
router.use('/os', osRoutes);

// Moculo Empresa
router.use('/empresas', empresaRoutes);

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


module.exports = router;
