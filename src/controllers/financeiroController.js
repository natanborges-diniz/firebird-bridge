// src/controllers/financeiroController.js

const financeiroService = require('../services/financeiroService');
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

async function listarParcelas(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rows = await financeiroService.getParcelas(params);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// manter stub de DRE se ainda não estiver pronto
async function obterDRE(req, res) {
  try {
    return failure(res, {
      code: 'NOT_IMPLEMENTED',
      message: 'Endpoint DRE ainda não implementado nesta versão',
      status: 501,
    });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  listarParcelas,
  obterDRE,
};
