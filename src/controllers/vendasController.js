// src/controllers/vendasController.js
const { getResumoEmpresaVendedor } = require('../services/vendasService');

async function resumoEmpresaVendedor(req, res) {
  try {
    const { dataInicio, dataFim } = req.query;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios: dataInicio e dataFim (YYYY-MM-DD)'
      });
    }

    const data = await getResumoEmpresaVendedor({ dataInicio, dataFim });
    res.json({ data });

  } catch (err) {
    console.error('❌ Erro resumoEmpresaVendedor:', err);
    res.status(500).json({ error: 'Erro interno no bridge' });
  }
}

module.exports = {
  resumoEmpresaVendedor
};
