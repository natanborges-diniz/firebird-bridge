// src/controllers/vendasAnaliseController.js
const { getAnaliseFamiliaVendedor } = require('../services/vendasAnaliseService');

async function analiseFamiliaVendedor(req, res) {
  try {
    const { dataInicio, dataFim, codEmpresa } = req.query;

    if (!dataInicio || !dataFim) {
      return res
        .status(400)
        .json({ error: 'Parâmetros dataInicio e dataFim são obrigatórios' });
    }

    const useCache = req.query.cache !== '0' && req.query.cache !== 'false';
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await getAnaliseFamiliaVendedor({
      dataInicio,
      dataFim,
      codEmpresa: codEmpresa ? Number(codEmpresa) : null,
      useCache,
      cacheTtlMs,
    });

    res.json({ data: rows });
  } catch (err) {
    console.error('❌ Erro analiseFamiliaVendedor:', err);
    res
      .status(500)
      .json({ error: 'Erro ao buscar análise de vendas por família/vendedor' });
  }
}

module.exports = {
  analiseFamiliaVendedor
};
