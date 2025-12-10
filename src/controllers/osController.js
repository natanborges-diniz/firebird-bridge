// src/controllers/osController.js

const osService = require('../services/osService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

function validatePeriodoQuery(req, res) {
  const { dataInicio, dataFim, codEmpresa, empresa } = req.query;

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

  let codEmpresaNum = null;
  const rawEmpresa = codEmpresa ?? empresa;
  if (rawEmpresa !== undefined && rawEmpresa !== null && rawEmpresa !== '') {
    const num = Number(rawEmpresa);
    if (!Number.isFinite(num)) {
      failure(res, {
        code: 'INVALID_PARAMS',
        message: 'codEmpresa deve ser numérico',
        details: { codEmpresa: rawEmpresa },
        status: 400,
      });
      return null;
    }
    codEmpresaNum = num;
  }

  return {
    dataInicio,
    dataFim,
    codEmpresa: codEmpresaNum,
  };
}

/**
 * GET /os/monitor?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD&codEmpresa=595
 */
async function monitorOs(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rows = await osService.getMonitorOs(params);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  monitorOs,
};
