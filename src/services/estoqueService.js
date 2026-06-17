// src/services/estoqueService.js
const path = require("path");
const fs = require("fs");
const db = require("../db"); // expõe db.query
const { parseEmpresasParam } = require("../utils/empresaHelper");

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "estoque", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlAnaliseEstoqueAcao = loadSql("analise_estoque_acao.sql");
const sqlEstoqueCompleto    = loadSql("estoque_completo.sql");
const sqlUltimoCusto        = loadSql("estoque_ultimo_custo.sql");

/**
 * Análise de estoque com ação sugerida por empresa.
 * @param {number|string} codEmpresa
 */
async function getAnaliseEstoqueAcao(codEmpresa) {
  const params = [codEmpresa];
  const rows = await db.query(sqlAnaliseEstoqueAcao, params);
  return rows;
}

/**
 * Estoque completo (prateleira) por empresa.
 * @param {string|number} empresa
 */
async function getEstoqueCompleto(empresa) {
  const empresas = parseEmpresasParam(empresa);
  const results = await Promise.allSettled(
    empresas.map((codEmpresa) => db.query(sqlEstoqueCompleto, [codEmpresa]))
  );

  const rows = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ?? [];
    }
    console.error(
      `[ESTOQUE] estoque-completo empresa ${empresas[index]}:`,
      result.reason?.message || result.reason
    );
    return [];
  });

  if (results.length > 0 && results.every((result) => result.status === "rejected")) {
    throw results[0].reason;
  }

  return rows;
}

/**
 * Custo da última compra (entrada tipo=2, mais recente por data) por SKU.
 * Retorna todos os SKUs em estoque; SKUs sem histórico de entrada têm
 * custo_ultima_compra=null.
 * @param {string|number} empresa
 */
async function getEstoqueUltimoCusto(empresa) {
  const empresas = parseEmpresasParam(empresa);
  const results = await Promise.allSettled(
    empresas.map((codEmpresa) => db.query(sqlUltimoCusto, [codEmpresa]))
  );

  const rows = results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ?? [];
    }
    console.error(
      `[ESTOQUE] ultimo-custo empresa ${empresas[index]}:`,
      result.reason?.message || result.reason
    );
    return [];
  });

  if (results.length > 0 && results.every((r) => r.status === "rejected")) {
    throw results[0].reason;
  }

  return rows;
}

module.exports = {
  getAnaliseEstoqueAcao,
  getEstoqueCompleto,
  getEstoqueUltimoCusto,
};
