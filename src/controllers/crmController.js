// src/controllers/crmController.js
const crmService = require("../services/crmService");
const { success, failure, handleControllerError } = require("../utils/apiResponse");

/**
 * Normaliza o parâmetro de empresa.
 * Aceita ?empresa= ou ?codEmpresa=. "ALL"/vazio => null (todas).
 * Retorna `undefined` se o valor for inválido (e já responde 400).
 */
function normalizeCodEmpresa(req, res) {
  const rawEmpresa = req.query.empresa ?? req.query.codEmpresa;

  if (
    rawEmpresa === undefined ||
    rawEmpresa === null ||
    rawEmpresa === "" ||
    String(rawEmpresa).toUpperCase() === "ALL"
  ) {
    return null;
  }

  const num = Number(rawEmpresa);
  if (!Number.isFinite(num)) {
    failure(res, {
      code: "INVALID_PARAMS",
      message: "empresa deve ser numérico ou ALL",
      details: { empresa: rawEmpresa },
      status: 400,
    });
    return undefined;
  }

  return num;
}

// GET /api/v1/crm/base?empresa=1
async function baseClientesEntrega(req, res) {
  try {
    const codEmpresa = normalizeCodEmpresa(req, res);
    // valor inválido: normalizeCodEmpresa já respondeu 400
    if (codEmpresa === undefined) return;

    const rows = await crmService.getBaseClientesEntrega({ codEmpresa });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  baseClientesEntrega,
};
