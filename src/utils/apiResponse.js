// src/utils/apiResponse.js
const { normalizeEmpresas } = require('./empresaNormalizer');

function success(res, data, status = 200) {
  const normalizedData = normalizeEmpresas(data);
  return res.status(status).json({
    ok: true,
    data: normalizedData,
    error: null
  });
}

function failure(res, { code, message, details = null, status = 400 }) {
  return res.status(status).json({
    ok: false,
    data: null,
    error: {
      code,
      message,
      details
    }
  });
}

function handleControllerError(res, err) {
  console.error('[ControllerError]', err);

  return failure(res, {
    code: 'INTERNAL_ERROR',
    message: 'Erro inesperado no servidor',
    details: null,
    status: 500
  });
}

module.exports = {
  success,
  failure,
  handleControllerError
};
