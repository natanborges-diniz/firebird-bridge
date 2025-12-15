// src/controllers/osController.js
const osService = require("../services/osService");
const { success, failure, handleControllerError } = require("../utils/apiResponse");

function validatePeriodoQuery(req, res) {
  const { dataInicio, dataFim, codEmpresa, empresa } = req.query;

  const missing = [];
  if (!dataInicio) missing.push("dataInicio");
  if (!dataFim) missing.push("dataFim");

  if (missing.length > 0) {
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
    return { dataInicio, dataFim, codEmpresa: null };
  }

  const num = Number(rawEmpresa);
  if (!Number.isFinite(num)) {
    failure(res, {
      code: "INVALID_PARAMS",
      message: "codEmpresa deve ser numérico ou ALL",
      details: { codEmpresa: rawEmpresa },
      status: 400,
    });
    return null;
  }

  // Mapeia código lógico -> cod_empresaorigem real
  const COD_EMPRESA_LOGICA_PARA_ORIGEM = {
    595: 1, // PRIMITIVA I
    // 597: <preencher>,
    // 599: <preencher>,
  };

  const codEmpresaFinal = COD_EMPRESA_LOGICA_PARA_ORIGEM[num] ?? num;

  return { dataInicio, dataFim, codEmpresa: codEmpresaFinal };
}

async function monitorOs(req, res) {
  try {
    const params = validatePeriodoQuery(req, res);
    if (!params) return;

    const rows = await osService.getMonitorOs(params);
    return success(res, rows);
  } } catch (err) {
  console.error("[OS/MONITOR] ERRO:", err);        // <-- isso aqui
  return handleControllerError(res, err);
  }
}

module.exports = {
  monitorOs,
};
