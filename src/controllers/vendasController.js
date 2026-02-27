// src/controllers/vendasController.js
const vendasService = require("../services/vendasService");
const { success, handleControllerError } = require("../utils/apiResponse");
const { validatePeriodoEmpresaQuery } = require("./_validators");

async function resumoEmpresaVendedor(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const excluirCreditos = req.query.excluirCreditos === "1" || req.query.excluirCreditos === "true";
    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getResumoEmpresaVendedor({
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

async function resumoFormasPagamento(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const excluirCreditos = req.query.excluirCreditos === "1" || req.query.excluirCreditos === "true";
    const incluirDevolucoes = req.query.incluirDevolucoes === "1" || req.query.incluirDevolucoes === "true";
    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getFormasPagamentoResumo({
      ...params,
      excluirCreditos,
      incluirDevolucoes,
      useCache,
      cacheTtlMs,
    });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

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

async function auditoriaFormasPagamento(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const excluirCreditos = req.query.excluirCreditos === "1" || req.query.excluirCreditos === "true";
    const page = req.query.page ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getFormasPagamentoAuditoria({
      ...params,
      excluirCreditos,
      page,
      pageSize,
      useCache,
      cacheTtlMs,
    });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function auditoriaFormasPagamentoLight(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const excluirCreditos = req.query.excluirCreditos === "1" || req.query.excluirCreditos === "true";
    const page = req.query.page ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getFormasPagamentoAuditoriaLight({
      ...params,
      excluirCreditos,
      page,
      pageSize,
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

    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getAnaliseFamiliaVendedor({
      ...params,
      useCache,
      cacheTtlMs,
    });

    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function analiseSku(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const useCache = req.query.cache !== "0" && req.query.cache !== "false";
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await vendasService.getAnaliseSku({
      ...params,
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
  resumoDiarioSimples,
  auditoriaFormasPagamento,
  auditoriaFormasPagamentoLight,
  debugResumoEmpresaVendedor,
  analiseFamiliaVendedor,
  analiseSku,
};
