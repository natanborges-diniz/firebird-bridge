// src/utils/apiResponse.js

/**
 * Resposta de sucesso padrão { ok, data, error }.
 * `meta` (opcional) carrega avisos não fatais — ex.: meta.empresasComErro
 * quando parte das empresas falhou num fan-out mas há dados parciais (D13).
 */
function success(res, data, meta) {
  const body = {
    ok: true,
    data,
    error: null,
  };
  if (meta && Object.keys(meta).length > 0) {
    body.meta = meta;
  }
  return res.json(body);
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
