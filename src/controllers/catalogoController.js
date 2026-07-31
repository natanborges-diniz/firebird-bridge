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
    const { tipo, limit } = req.query;
    const rows = await catalogoService.getItensCadastro(tipo, limit);
    return success(res, rows);
  } catch (err) {
    if (err.code === 'INVALID_TIPO' || err.code === 'INVALID_LIMIT') {
      return failure(res, {
        code: 'INVALID_PARAMS',
        message: err.message,
        details: { tipo: req.query.tipo, limit: req.query.limit },
        status: 400,
      });
    }
    // Endpoint interno de sync: expõe a mensagem do driver para diagnóstico
    // (sem stack trace). handleControllerError já loga o erro completo.
    console.error('[CATALOGO] itens:', err);
    return failure(res, {
      code: 'QUERY_ERROR',
      message: 'Falha ao consultar o cadastro de produtos',
      details: { firebird: String(err && err.message ? err.message : err) },
      status: 500,
    });
  }
}

module.exports = {
  itensCadastro,
};
