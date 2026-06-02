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

/** Valida se string é uma data ISO no formato YYYY-MM-DD. */
function isIsoDate(str) {
  return typeof str === "string" && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

// GET /api/v1/crm/base?empresa=1
async function baseClientesEntrega(req, res) {
  try {
    const codEmpresa = normalizeCodEmpresa(req, res);
    if (codEmpresa === undefined) return;

    const rows = await crmService.getBaseClientesEntrega({ codEmpresa });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// GET /api/v1/crm/entregas?empresa=1&dataIni=YYYY-MM-DD&dataFim=YYYY-MM-DD
async function entregasPorData(req, res) {
  try {
    const codEmpresa = normalizeCodEmpresa(req, res);
    if (codEmpresa === undefined) return;

    const { dataIni, dataFim } = req.query;
    if (!isIsoDate(dataIni) || !isIsoDate(dataFim)) {
      return failure(res, {
        code: "INVALID_PARAMS",
        message: "dataIni e dataFim são obrigatórios no formato YYYY-MM-DD",
        details: { dataIni, dataFim },
        status: 400,
      });
    }
    if (dataIni > dataFim) {
      return failure(res, {
        code: "INVALID_PARAMS",
        message: "dataIni não pode ser posterior a dataFim",
        status: 400,
      });
    }

    const rows = await crmService.getEntregasPorData({ codEmpresa, dataIni, dataFim });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// GET /api/v1/crm/aniversariantes?empresa=1&data=YYYY-MM-DD
// (data omitida = CURRENT_DATE do servidor)
async function aniversariantes(req, res) {
  try {
    const codEmpresa = normalizeCodEmpresa(req, res);
    if (codEmpresa === undefined) return;

    const rawData = req.query.data;
    let dataAlvo;
    if (rawData) {
      if (!isIsoDate(rawData)) {
        return failure(res, {
          code: "INVALID_PARAMS",
          message: "data deve estar no formato YYYY-MM-DD",
          details: { data: rawData },
          status: 400,
        });
      }
      dataAlvo = rawData;
    } else {
      // Padrão: hoje no servidor
      dataAlvo = new Date().toISOString().slice(0, 10);
    }

    const rows = await crmService.getAniversariantes({ codEmpresa, dataAlvo });
    return success(res, rows);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// GET /api/v1/crm/venda?numero=<n>[&empresa=<cod>]
async function getVenda(req, res) {
  try {
    const rawNumero = req.query.numero;
    if (!rawNumero || String(rawNumero).trim() === "") {
      return failure(res, {
        code: "INVALID_PARAMS",
        message: "Informe o número da venda em ?numero=",
        status: 400,
      });
    }

    const numero = Number(rawNumero);
    if (!Number.isFinite(numero)) {
      return failure(res, {
        code: "INVALID_PARAMS",
        message: "numero deve ser numérico",
        details: { numero: rawNumero },
        status: 400,
      });
    }

    const codEmpresa = normalizeCodEmpresa(req, res);
    if (codEmpresa === undefined) return;

    const data = await crmService.getVenda({ numero, codEmpresa });

    if (data === null) {
      return failure(res, {
        code: "NOT_FOUND",
        message: `Venda ${numero} não encontrada`,
        status: 404,
      });
    }

    return success(res, data);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  baseClientesEntrega,
  entregasPorData,
  aniversariantes,
  getVenda,
};
