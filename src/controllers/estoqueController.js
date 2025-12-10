// src/controllers/estoqueController.js

const estoqueService = require('../services/estoqueService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

/**
 * Valida o parâmetro codEmpresa/empresa.
 * Obrigatório, numérico.
 */
function validateEmpresa(req, res) {
  const { codEmpresa, empresa } = req.query;
  const valor = codEmpresa ?? empresa;

  if (!valor) {
    failure(res, {
      code: 'INVALID_PARAMS',
      message: 'Parâmetro codEmpresa é obrigatório',
      details: { missing: ['codEmpresa'] },
      status: 400
    });
    return null;
  }

  const num = Number(valor);
  if (!Number.isFinite(num)) {
    failure(res, {
      code: 'INVALID_PARAMS',
      message: 'codEmpresa deve ser numérico',
      details: { codEmpresa: valor },
      status: 400
    });
    return null;
  }

  return num;
}

/**
 * GET /estoque/analise-acao?codEmpresa=...
 */
async function analiseEstoqueAcao(req, res) {
  try {
    const codEmpresa = validateEmpresa(req, res);
    if (codEmpresa == null) return;

    const rows = await estoqueService.getAnaliseEstoqueAcao(codEmpresa);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  analiseEstoqueAcao
};
