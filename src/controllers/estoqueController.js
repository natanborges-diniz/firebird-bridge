// src/controllers/estoqueController.js

const estoqueService = require('../services/estoqueService');
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

async function analiseEstoque(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rows = await estoqueService.getAnaliseEstoque(params);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  analiseEstoque
};
