// src/controllers/catalogoController.js

const catalogoService = require('../services/catalogoService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

/**
 * GET /catalogo/itens?tipo=LENTES
 * Cadastro completo de produtos (sem estoque). Filtro ?tipo= opcional:
 * ARMACOES, LENTES_GRAU, LENTES_CONTATO, ACESSORIOS, OUTROS, LENTES (alias),
 * ALL/vazio = todos.
 */
async function itensCadastro(req, res) {
  try {
    const { tipo } = req.query;
    const rows = await catalogoService.getItensCadastro(tipo);
    return success(res, rows);
  } catch (err) {
    if (err.code === 'INVALID_TIPO') {
      return failure(res, {
        code: 'INVALID_PARAMS',
        message: err.message,
        details: { tipo: req.query.tipo },
        status: 400,
      });
    }
    return handleControllerError(res, err);
  }
}

module.exports = {
  itensCadastro,
};
