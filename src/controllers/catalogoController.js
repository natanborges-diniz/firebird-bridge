// src/controllers/catalogoController.js

const catalogoService = require('../services/catalogoService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

/**
 * GET /catalogo/itens?tipo=LENTES
 * Cadastro de produtos (sem estoque). Filtro ?tipo= opcional:
 * ARMACOES, LENTES_GRAU, LENTES_CONTATO, ACESSORIOS, OUTROS, LENTES (alias),
 * ALL/vazio = todos. Sync incremental via ?desde=YYYY-MM-DD[THH:MM:SS]
 * (só linhas alteradas/incluídas desde então; inclui inativos por padrão).
 */
async function itensCadastro(req, res) {
  try {
    const { tipo, limit, offset, incluirInativos, desde, aposCod, codigoBarras } = req.query;
    const { rows, meta } = await catalogoService.getItensCadastro({ tipo, limit, offset, incluirInativos, desde, aposCod, codigoBarras });
    // shape padrão {ok,data,error} + meta de paginação keyset (fim/proximo_cod)
    return res.status(200).json({ ok: true, data: rows, meta, error: null });
  } catch (err) {
    if (err.code === 'INVALID_TIPO' || err.code === 'INVALID_LIMIT' || err.code === 'INVALID_DESDE') {
      return failure(res, {
        code: 'INVALID_PARAMS',
        message: err.message,
        details: { tipo: req.query.tipo, limit: req.query.limit, offset: req.query.offset, desde: req.query.desde },
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
