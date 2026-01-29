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
const sqlEstoqueCompleto = loadSql("estoque_completo.sql");

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

  return results.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return result.value ?? [];
    }
    console.error(
      `[ESTOQUE] estoque-completo empresa ${empresas[index]}:`,
      result.reason?.message || result.reason
    );
    return [];
  });
}

module.exports = {
  getAnaliseEstoqueAcao,
  getEstoqueCompleto
};
