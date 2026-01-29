// src/controllers/estoqueController.js

const estoqueService = require('../services/estoqueService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');
const { parseEmpresasParam } = require('../utils/empresaHelper');

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
 * Valida o parâmetro empresa para listas/ALL.
 */
function validateEmpresaLista(req, res) {
  const { codEmpresa, empresa } = req.query;
  const valor = codEmpresa ?? empresa;

  if (!valor) {
    failure(res, {
      code: 'INVALID_PARAMS',
      message: 'Parâmetro empresa é obrigatório',
      details: { missing: ['empresa'] },
      status: 400
    });
    return null;
  }

  const empresas = parseEmpresasParam(valor);
  if (!empresas.length) {
    failure(res, {
      code: 'INVALID_PARAMS',
      message: 'Nenhuma empresa válida informada',
      details: { empresa: valor },
      status: 400
    });
    return null;
  }

  return valor;
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

/**
 * GET /estoque/completo?empresa=...
 */
async function estoqueCompleto(req, res) {
  try {
    const empresaParam = validateEmpresaLista(req, res);
    if (empresaParam == null) return;

    const rows = await estoqueService.getEstoqueCompleto(empresaParam);
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  analiseEstoqueAcao,
  estoqueCompleto
};
