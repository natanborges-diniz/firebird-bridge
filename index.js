// index.js
const express = require('express');
const cors = require('cors');
const { getResumoEmpresaVendedor } = require('./src/services/vendasService');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

/**
 * GET /api/v1/vendas/resumo-empresa-vendedor
 * Exemplo:
 *   /api/v1/vendas/resumo-empresa-vendedor?dataInicio=2025-01-01&dataFim=2025-01-31
 */
app.get('/api/v1/vendas/resumo-empresa-vendedor', async (req, res) => {
  try {
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios: dataInicio, dataFim (YYYY-MM-DD)'
      });
    }

    const data = await getResumoEmpresaVendedor({ dataInicio, dataFim });
    res.json({ data });

  } catch (err) {
    console.error('❌ Erro resumo-empresa-vendedor:', err);
    res.status(500).json({ error: 'Erro interno no bridge' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 firebird-bridge rodando na porta ${port}`);
});
