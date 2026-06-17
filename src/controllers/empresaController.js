// src/controllers/empresaController.js
const empresaService = require("../services/empresaService");
const { success, handleControllerError } = require("../utils/apiResponse");

async function listarEmpresas(req, res) {
  try {
    const useCache = req.query.cache !== '0' && req.query.cache !== 'false';
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const rows = await empresaService.getEmpresas({ useCache, cacheTtlMs });
    const empresas = rows
      .map((row) => {
        const codEmpresa = row.COD_EMPRESA ?? row.cod_empresa ?? null;
        const nomeEmpresa =
          row.EMPRESA_NOME ?? row.empresa_nome ?? row.NOME ?? row.nome ?? null;
        const nomeLogico =
          row.EMPRESA_NOME_LOGICO ??
          row.empresa_nome_logico ??
          nomeEmpresa ??
          null;
        const cnpj = row.CNPJ ?? row.cnpj ?? null;
        const razaoSocial = row.RAZAOSOCIAL ?? row.razaosocial ?? null;

        return {
          cod_empresa: codEmpresa,
          empresa_nome: nomeEmpresa,
          empresa_cod_logico: codEmpresa,
          empresa_nome_logico: nomeLogico,
          cnpj: cnpj ? String(cnpj).trim() || null : null,
          razao_social: razaoSocial ? String(razaoSocial).trim() || null : null,
        };
      })
      .sort((a, b) => (a.empresa_nome ?? '').localeCompare(b.empresa_nome ?? ''));
    return success(res, empresas);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  listarEmpresas,
};
