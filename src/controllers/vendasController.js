// src/controllers/vendasController.js

const vendasService = require('../services/vendasService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

function validatePeriodoQuery(req, res) {
  const { empresa, dataInicio, dataFim } = req.query;

  const missing = [];
  if (!dataInicio) missing.push('dataInicio');
  if (!dataFim) missing.push('dataFim');

  if (missing.length > 0) {
    failure(res, {
      code: 'INVALID_PARAMS',
      message: 'Parâmetros obrigatórios ausentes',
      details: { missing },
      status: 400,
    });
    return null;
  }

  return { empresa, dataInicio, dataFim };
}

async function resumoEmpresaVendedor(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rows = await vendasService.getResumoEmpresaVendedor(params);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function resumoFormasPagamento(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rows = await vendasService.getFormasPagamentoResumo(params);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function debugResumoEmpresaVendedor(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res); // mesma validação do outro
    if (!params) return;

    const empresaParam = params.empresa; // precisa ser número
    const p = [empresaParam, empresaParam, params.dataInicio, params.dataFim];

    const rows = await vendasService.debugResumoEmpresaVendedor(p);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function analiseFamiliaVendedor(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    // opcional: seu service aceita codEmpresaEstoque (se existir)
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
