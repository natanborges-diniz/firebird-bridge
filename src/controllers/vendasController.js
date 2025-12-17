// src/controllers/vendasController.js
const vendasService = require("../services/vendasService");
const { success, handleControllerError } = require("../utils/apiResponse");
const { validatePeriodoEmpresaQuery } = require("./_validators");

async function resumoEmpresaVendedor(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const rows = await vendasService.getResumoEmpresaVendedor(params);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function resumoFormasPagamento(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const rows = await vendasService.getFormasPagamentoResumo(params);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function debugResumoEmpresaVendedor(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    // debug precisa de empresa específica (não ALL)
    if (!params.empresa || String(params.empresa).toUpperCase() === "ALL") {
      return success(res, []);
    }

    const codEmpresa = parseInt(String(params.empresa), 10);
    if (!Number.isFinite(codEmpresa)) return success(res, []);

    const p = [codEmpresa, codEmpresa, params.dataInicio, params.dataFim];
    const rows = await vendasService.debugResumoEmpresaVendedor(p);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function analiseFamiliaVendedor(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const codEmpresaEstoque = req.query.codEmpresaEstoque
      ? Number(req.query.codEmpresaEstoque)
      : null;

    const rows = await vendasService.getAnaliseFamiliaVendedor({
      ...params,
      codEmpresaEstoque,
    });

    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  resumoEmpresaVendedor,
  resumoFormasPagamento,
  analiseFamiliaVendedor,
  debugResumoEmpresaVendedor,
};
