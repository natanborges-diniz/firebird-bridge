// src/utils/apiResponse.js

function success(res, data, meta) {
  const payload = {
    ok: true,
    data,
    error: null
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.json(payload);
}

function failure(res, { code, message, details, status = 500 }) {
  return res.status(status).json({
    ok: false,
    data: null,
    error: {
      code,
      message,
      details: details || null
    }
  });
}

function handleControllerError(res, err) {
  console.error(err);

  return failure(res, {
    code: 'INTERNAL_ERROR',
    message: 'Erro inesperado ao processar a requisição',
    status: 500
  });
}

module.exports = {
  success,
  failure,
  handleControllerError
};
