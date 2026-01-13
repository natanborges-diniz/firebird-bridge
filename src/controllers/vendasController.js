// src/controllers/vendasController.js
const vendasService = require("../services/vendasService");
const { success, handleControllerError } = require("../utils/apiResponse");
const { validatePeriodoEmpresaQuery } = require("./_validators");

async function resumoEmpresaVendedor(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getResumoEmpresaVendedor({
      ...params,
      useCache,
      cacheTtlMs,
    });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function resumoFormasPagamento(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getFormasPagamentoResumo({
      ...params,
      useCache,
      cacheTtlMs,
    });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function debugResumoEmpresaVendedor(req, res) {
  try {
    if (req.query.action === "create-indexes") {
      await vendasService.debugCreateIndexes();
      return success(res, { message: "Índices criados" });
    }

    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const empresaParam = params.empresa;
    if (empresaParam === null) return success(res, []);

    const p = [empresaParam, empresaParam, params.dataInicio, params.dataFim];
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

    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getAnaliseFamiliaVendedor({
      ...params,
      codEmpresaEstoque,
      useCache,
      cacheTtlMs,
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
