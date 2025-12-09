// src/controllers/vendasController.js

const vendasService = require('../services/vendasService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

function validatePeriodo(req, res) {
  const { dataInicio, dataFim } = req.query;

  const missing = [];
  if (!dataInicio) missing.push('dataInicio');
  if (!dataFim) missing.push('dataFim');

  if (missing.length > 0) {
    failure(res, {
      code: 'INVALID_PARAMS',
      message: 'Parâmetros obrigatórios ausentes',
      details: { missing },
      status: 400
    });
    return null;
  }

  return { dataInicio, dataFim };
}

/**
 * GET /vendas/resumo-empresa-vendedor
 */
async function resumoEmpresaVendedor(req, res) {
  try {
    const periodo = validatePeriodo(req, res);
    if (!periodo) return;

    const rows = await vendasService.getResumoEmpresaVendedor({
      dataIni: periodo.dataInicio,
      dataFim: periodo.dataFim
    });

    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

/**
 * GET /vendas/resumo-formas-pagamento
 */
async function resumoFormasPagamento(req, res) {
  try {
    const periodo = validatePeriodo(req, res);
    if (!periodo) return;

    const rows = await vendasService.getResumoFormasPagamento({
      dataIni: periodo.dataInicio,
      dataFim: periodo.dataFim
    });

    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

/**
 * GET /vendas/analise-familia-vendedor
 * codEmpresa é opcional (aceita também 'empresa' como alias)
 */
async function analiseFamiliaVendedor(req, res) {
  try {
    const periodo = validatePeriodo(req, res);
    if (!periodo) return;

    const { codEmpresa, empresa } = req.query;
    const empresaFinal = codEmpresa ?? empresa ?? null;

    const rows = await vendasService.getAnaliseFamiliaVendedor({
      dataIni: periodo.dataInicio,
      dataFim: periodo.dataFim,
      codEmpresa: empresaFinal
    });

    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  resumoEmpresaVendedor,
  resumoFormasPagamento,
  analiseFamiliaVendedor
};
