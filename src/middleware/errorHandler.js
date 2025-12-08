// src/middleware/errorHandler.js

const { failure } = require('../utils/apiResponse');

function errorHandler(err, req, res, next) {
  console.error('Erro não tratado:', err);

  if (res.headersSent) {
    return next(err);
  }

  return failure(res, {
    code: 'INTERNAL_ERROR',
    message: 'Erro inesperado ao processar a requisição',
    status: 500
  });
}

module.exports = errorHandler;
