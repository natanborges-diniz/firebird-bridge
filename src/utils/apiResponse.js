// src/utils/apiResponse.js

function success(res, data) {
  return res.json({
    ok: true,
    data,
    error: null,
  });
}

function failure(res, { code, message, details = null, status = 400 }) {
  return res.status(status).json({
    ok: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
  });
}

function handleControllerError(res, err) {
  console.error('[ControllerError]', err);

  return failure(res, {
    code: 'INTERNAL_ERROR',
    message: 'Erro inesperado na aplicação',
    details: null,
    status: 500,
  });
}

module.exports = {
  success,
  failure,
  handleControllerError,
};
