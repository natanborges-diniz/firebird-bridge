// src/controllers/osController.js

const osService = require('../services/osService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

function validatePeriodoQuery(req, res) {
  const { empresa, dataInicio, dataFim } = req.query;

  const missing = [];
  if (!empresa) missing.push('empresa');
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

  return { empresa, dataInicio, dataFim };
}

async function monitor(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rows = await osService.getMonitor(params);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  monitor
};
