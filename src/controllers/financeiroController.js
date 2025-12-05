// src/controllers/financeiroController.js
const financeiroService = require("../services/financeiroService");

/**
 * GET /api/v1/financeiro/parcelas
 * Query params:
 *  - dataIni (YYYY-MM-DD)
 *  - dataFim (YYYY-MM-DD)
 *  - empresa (código da empresa)
 */
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

/**
 * GET /api/v1/financeiro/dre
 * Query params:
 *  - dataIni (YYYY-MM-DD)
 *  - dataFim (YYYY-MM-DD)
 *  - empresa (código da empresa)
 * Competência = data de emissão (já tratada no SQL)
 */
async function listarDre(req, res) {
  try {
    const { dataIni, dataFim, empresa } = req.query;

    if (!dataIni || !dataFim || !empresa) {
      return res.status(400).json({
        error: "Parâmetros obrigatórios: dataIni, dataFim, empresa",
      });
    }

    const dre = await financeiroService.getDre({
      dataIni,
      dataFim,
      codEmpresa: empresa,
    });

    return res.json({
      ok: true,
      count: dre.length,
      rows: dre,
    });
  } catch (err) {
    console.error("Erro em listarDre:", err);
    return res.status(500).json({
      error: "Erro interno ao montar DRE gerencial",
    });
  }
}

module.exports = {
  listarParcelas,
  listarDre,
};
