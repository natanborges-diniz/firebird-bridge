const { failure } = require("../utils/apiResponse");

/**
 * Valida período + empresa.
 * Aceita:
 * - dataInicio, dataFim obrigatórios
 * - empresa/codEmpresa opcional (numérico)
 * - permite ALL para “todas”
 */
function validatePeriodoEmpresaQuery(req, res) {
  const { dataInicio, dataFim, empresa, codEmpresa } = req.query;

  const missing = [];
  if (!dataInicio) missing.push("dataInicio");
  if (!dataFim) missing.push("dataFim");

  if (missing.length) {
    failure(res, {
      code: "INVALID_PARAMS",
      message: "Parâmetros obrigatórios ausentes",
      details: { missing },
      status: 400,
    });
    return null;
  }

  const rawEmpresa = codEmpresa ?? empresa;

  // ALL/vazio => todas
  if (
    rawEmpresa === undefined ||
    rawEmpresa === null ||
    rawEmpresa === "" ||
    String(rawEmpresa).toUpperCase() === "ALL"
  ) {
    return { dataInicio, dataFim, empresa: null };
  }

  const num = Number(rawEmpresa);
  if (!Number.isFinite(num)) {
    failure(res, {
      code: "INVALID_PARAMS",
      message: "empresa/codEmpresa deve ser numérico ou ALL",
      details: { empresa: rawEmpresa },
      status: 400,
    });
    return null;
  }

  return { dataInicio, dataFim, empresa: num };
}

// compat: caso você ainda chame validatePeriodoQuery em algum lugar
function validatePeriodoQuery(req, res) {
  const r = validatePeriodoEmpresaQuery(req, res);
  if (!r) return null;
  return { dataInicio: r.dataInicio, dataFim: r.dataFim, codEmpresa: r.empresa };
}

module.exports = {
  validatePeriodoEmpresaQuery,
  validatePeriodoQuery,
};
