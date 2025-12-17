// src/controllers/_validators.js
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

  // ALL / vazio
  if (
    rawEmpresa === undefined ||
    rawEmpresa === null ||
    rawEmpresa === "" ||
    String(rawEmpresa).toUpperCase() === "ALL"
  ) {
    return { dataInicio, dataFim, empresa: "ALL" };
  }

  // mantém string (pode vir "1,9,13")
  return { dataInicio, dataFim, empresa: String(rawEmpresa) };
}

module.exports = { validatePeriodoEmpresaQuery };
