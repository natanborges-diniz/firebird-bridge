// src/controllers/financeiroController.js

const financeiroService = require("../services/financeiroService");

async function listarParcelas(req, res) {
  try {
    const { dataIni, dataFim, empresa } = req.query;

    if (!dataIni || !dataFim || !empresa) {
      return res.status(400).json({
        error: "Parâmetros obrigatórios: dataIni, dataFim, empresa",
      });
    }

    const parcelas = await financeiroService.getParcelas({
      dataIni,
      dataFim,
      codEmpresa: empresa,
    });

    return res.json({
      ok: true,
      count: parcelas.length,
      rows: parcelas,
    });
  } catch (err) {
    console.error("Erro em listarParcelas:", err);
    return res.status(500).json({
      error: "Erro interno ao buscar parcelas financeiras",
    });
  }
}

module.exports = {
  listarParcelas,
};
