// src/controllers/osController.js
const osService = require('../services/osService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');
const COD_EMPRESA_LOGICA_PARA_ORIGEM = {
  595: 1,   // PRIMITIVA I -> cod_empresaorigem REAL
  597: 2,   // PRIMITIVA II -> exemplo
  599: 3,
  705: 4,
  601: 5,
  603: 6,
  605: 7,
  607: 8,
  609: 9,
  769: 10,
};

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
    if (codEmpresaNum !== null) {
  codEmpresaNum = COD_EMPRESA_LOGICA_PARA_ORIGEM[codEmpresaNum] ?? codEmpresaNum;
}
    return null;
  }

  // aceita codEmpresa ou empresa (alias)
  const raw = (codEmpresa ?? empresa);

  let codEmpresaNum = null;

  // "ALL" => todas empresas
  if (raw === undefined || raw === null || raw === '' || String(raw).toUpperCase() === 'ALL') {
    codEmpresaNum = null;
  } else {
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      failure(res, {
        code: 'INVALID_PARAMS',
        message: 'codEmpresa deve ser numérico ou ALL',
        details: { codEmpresa: raw },
        status: 400,
      });
      return null;
    }
    codEmpresaNum = num;
  }

  return { dataInicio, dataFim, codEmpresa: codEmpresaNum };
}

/**
 * GET /api/v1/os/monitor?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD&codEmpresa=595
 * GET /api/v1/os/monitor?dataInicio=...&dataFim=...&empresa=ALL
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

module.exports = { monitorOs };
