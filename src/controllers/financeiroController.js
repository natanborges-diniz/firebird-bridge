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
 * GET /api/v1/financeiro/debug/resumo-empresas
 * Não recebe parâmetros.
 * Retorna: cod_empresa, empresa_nome, min/max datavencimento, qtd_parcelas
 */
async function resumoPorEmpresa(req, res) {
  try {
    const rows = await financeiroService.getResumoPorEmpresa();

    return res.json({
      ok: true,
      count: rows.length,
      rows,
    });
  } catch (err) {
    console.error("Erro em resumoPorEmpresa:", err);
    return res.status(500).json({
      error: "Erro interno ao gerar resumo por empresa",
    });
  }
}

module.exports = {
  listarParcelas,
  resumoPorEmpresa,
};
