// src/controllers/recebimentosController.js
//
// Fase 1 — Dados de recebimento (docs/REVISAO_VENDAS_METAS.md §5.1).
// Endpoints sob /api/v1/vendas:
//   GET /recebimentos               — detalhe de parcelas pagas no periodo
//   GET /recebimentos/agregado      — agregado p/ sync diario
//   GET /emitidos                   — modo alternativo "emitido em OS"
//   GET /devolucoes-restituicao     — devolucoes com restituicao (PENDENTE
//                                     VALIDACAO; fallback gracioso = vazio)
//
// Parametros: empresa (ALL/vazio = todas) + dataInicio/dataFim obrigatorios —
// nomes padrao do repo (docs/API_CONTRATO.md §2), validados por _validators.
const recebimentosService = require("../services/recebimentosService");
const validacaoRecebimentosService = require("../services/validacaoRecebimentosService");
const { success, handleControllerError } = require("../utils/apiResponse");
const { validatePeriodoEmpresaQuery } = require("./_validators");

function parseCommonQuery(req) {
  return {
    useCache: req.query.cache !== "0" && req.query.cache !== "false",
    cacheTtlMs: req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined,
  };
}

async function recebimentosDetalhe(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const { rows, empresasComErro } = await recebimentosService.getRecebimentosDetalhe({
      ...params,
      ...parseCommonQuery(req),
    });
    return success(res, rows, empresasComErro?.length ? { empresasComErro } : undefined);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function recebimentosAgregado(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const { rows, empresasComErro } = await recebimentosService.getRecebimentosAgregado({
      ...params,
      ...parseCommonQuery(req),
    });
    return success(res, rows, empresasComErro?.length ? { empresasComErro } : undefined);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function emitidos(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const { rows, empresasComErro } = await recebimentosService.getEmitidos({
      ...params,
      ...parseCommonQuery(req),
    });
    return success(res, rows, empresasComErro?.length ? { empresasComErro } : undefined);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

async function devolucoesRestituicao(req, res) {
  try {
    const params = validatePeriodoEmpresaQuery(req, res);
    if (!params) return;

    const { rows, empresasComErro } = await recebimentosService.getDevolucoesRestituicao({
      ...params,
      ...parseCommonQuery(req),
    });
    return success(res, rows, empresasComErro?.length ? { empresasComErro } : undefined);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

// Diagnostico read-only da Fase 1 (roda no Railway, unico ambiente com acesso
// ao Firebird): distribuicao de tipos de pagamento, amostra, totais, hipotese
// de devolucoes e recebido vs emitido. Amostras limitadas; sem paginacao.
async function validacao(req, res) {
  try {
    const empresa = String(req.query.empresa || "1").trim();
    const data = await validacaoRecebimentosService.validarRecebimentos({ empresa });
    return success(res, data);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  recebimentosDetalhe,
  recebimentosAgregado,
  emitidos,
  devolucoesRestituicao,
  validacao,
};
