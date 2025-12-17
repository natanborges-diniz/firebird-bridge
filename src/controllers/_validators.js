const { failure } = require("../utils/apiResponse");

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

  const isAll =
    rawEmpresa === undefined ||
    rawEmpresa === null ||
    rawEmpresa === "" ||
    String(rawEmpresa).toUpperCase() === "ALL";

  let empresaNum = null;

  if (!isAll) {
    const n = Number(rawEmpresa);
    if (!Number.isFinite(n)) {
      failure(res, {
        code: "INVALID_PARAMS",
        message: "empresa/codEmpresa deve ser numérico ou ALL",
        details: { empresa: rawEmpresa },
        status: 400,
      });
      return null;
    }
    empresaNum = n;
  }

  return { dataInicio, dataFim, empresa: empresaNum };
}

module.exports = { validatePeriodoEmpresaQuery };
