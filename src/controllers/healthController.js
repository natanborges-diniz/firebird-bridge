// src/controllers/healthController.js

const { pingDatabase } = require('../db');
const { success, failure } = require('../utils/apiResponse');

/**
 * Endpoint de verificação da saúde da API
 * 
 * /health
 * /health?checkDb=true
 */
async function health(req, res) {
  try {
    const checkDb = req.query.checkDb === 'true';

    // Apenas checa se o servidor Express está UP
    if (!checkDb) {
      return success(res, { status: 'UP', db: 'SKIPPED' });
    }

    // Tenta conexão com o Firebird
    const dbOk = await pingDatabase();

    if (dbOk) {
      return success(res, {
        status: 'UP',
        db: 'UP'
      });
    }

    // Se o pingDatabase() retornar false, houve falha de conexão
    return failure(res, {
      code: 'FIREBIRD_UNAVAILABLE',
      message: 'Não foi possível conectar ao banco Firebird',
      details: 'Conexão falhou — veja logs do servidor para mais detalhes.',
      status: 503
    });

  } catch (err) {
    // Captura erros inesperados na própria execução do health
    return failure(res, {
      code: 'INTERNAL_ERROR',
      message: 'Erro inesperado ao verificar saúde da aplicação',
      details: err?.message || String(err),
      status: 500
    });
  }
}

module.exports = {
  health
};
