// src/controllers/healthController.js

const { pingDatabase } = require('../db');
const { success, failure } = require('../utils/apiResponse');

async function health(req, res) {
  try {
    const checkDb = req.query.checkDb === 'true';

    if (!checkDb) {
      return success(res, { status: 'UP', db: 'SKIPPED' });
    }

    const dbOk = await pingDatabase();

    if (dbOk) {
      return success(res, { status: 'UP', db: 'UP' });
    }

    return failure(res, {
      code: 'FIREBIRD_UNAVAILABLE',
      message: 'Não foi possível conectar ao banco Firebird',
      status: 503
    });
  } catch (err) {
    return failure(res, {
      code: 'INTERNAL_ERROR',
      message: 'Erro inesperado ao verificar saúde da aplicação',
      status: 500
    });
  }
}

module.exports = {
  health
};
