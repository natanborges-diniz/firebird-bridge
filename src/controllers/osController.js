// src/controllers/osController.js
const { getMonitorProducao } = require('../services/osService');

async function monitorProducao(req, res) {
  try {
    const { dataInicio, dataFim, codEmpresa } = req.query;

    if (!dataInicio || !dataFim) {
      return res
        .status(400)
        .json({ error: 'Parâmetros dataInicio e dataFim são obrigatórios' });
    }

    const data = await getMonitorProducao({
      dataInicio,
      dataFim,
      codEmpresa
    });

    res.json({ data });
  } catch (err) {
    console.error('❌ Erro monitorProducao OS:', err);
    res.status(500).json({ error: 'Erro ao buscar monitor de produção (OS)' });
  }
}

module.exports = {
  monitorProducao
};
