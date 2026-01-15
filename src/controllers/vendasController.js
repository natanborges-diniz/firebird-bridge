// src/controllers/vendasController.js
const vendasService = require("../services/vendasService");
const { success, handleControllerError } = require("../utils/apiResponse");
const { validatePeriodoEmpresaQuery } = require("./_validators");

// ...

async function resumoDiarioSimples(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const excluirCreditos = req.query.excluirCreditos === "1" || req.query.excluirCreditos === "true";
    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getResumoDiarioSimples({
      ...params,
      excluirCreditos,
      useCache,
      cacheTtlMs,
    });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// ...

module.exports = {
  resumoEmpresaVendedor,
  resumoDiarioSimples,
  resumoFormasPagamento,
  auditoriaFormasPagamento,
  auditoriaFormasPagamentoLight,
  analiseFamiliaVendedor,
  debugResumoEmpresaVendedor,
};
