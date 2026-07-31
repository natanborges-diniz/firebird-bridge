// src/services/catalogoService.js
//
// Cadastro de produtos (catálogo) — SEM junção com estoque.
// Finalidade: alimentar a sincronização de catálogo externo (Atlas) com
// codigo_barras (PRODUTO.CODIGOBARRA) como chave estável por SKU.

const path = require("path");
const fs = require("fs");
const db = require("../db"); // expõe db.query

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "catalogo", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlItensCadastro = loadSql("itens_cadastro.sql");

// Tipos aceitos no filtro (?tipo=...). "LENTES" é alias das duas categorias.
const TIPOS_VALIDOS = new Set([
  "ARMACOES",
  "LENTES_GRAU",
  "LENTES_CONTATO",
  "ACESSORIOS",
  "OUTROS",
]);
const ALIAS_TIPO = {
  LENTES: ["LENTES_GRAU", "LENTES_CONTATO"],
};

// Candidatas de coluna de ativação do item (varia entre versões do ERP).
// A primeira que existir é usada; se nenhuma existir, o campo é omitido
// (padrão hasColumn — ver CLAUDE.md).
const ATIVO_CANDIDATAS = [
  ["ITEM", "ATIVO", "item.ativo"],
  ["PRODUTO", "ATIVO", "produto.ativo"],
  ["ITEM", "INATIVO", "item.inativo"],
];

let ativoSelectCache; // undefined = ainda não checado; string = fragmento; null = não existe

async function hasColumn(tableName, columnName) {
  const rows = await db.query(
    `
      SELECT 1
      FROM rdb$relation_fields rf
      JOIN rdb$relations r
        ON r.rdb$relation_name = rf.rdb$relation_name
      WHERE r.rdb$system_flag = 0
        AND TRIM(rf.rdb$relation_name) = ?
        AND TRIM(rf.rdb$field_name) = ?
    `,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function resolveAtivoSelect() {
  if (ativoSelectCache !== undefined) return ativoSelectCache;

  for (const [tabela, coluna, expressao] of ATIVO_CANDIDATAS) {
    // eslint-disable-next-line no-await-in-loop
    if (await hasColumn(tabela, coluna)) {
      const alias = coluna === "INATIVO" ? "inativo" : "ativo";
      ativoSelectCache = `,\n  ${expressao} AS ${alias}`;
      return ativoSelectCache;
    }
  }

  ativoSelectCache = null;
  return ativoSelectCache;
}

/**
 * Normaliza o parâmetro ?tipo= (CSV, case-insensitive, aceita alias LENTES).
 * Retorna null quando não há filtro (todos os tipos) ou um Set de tipos.
 * Lança erro com .code = "INVALID_TIPO" para valores desconhecidos.
 */
function parseTipoParam(tipo) {
  if (!tipo || String(tipo).trim().toUpperCase() === "ALL") return null;

  const tipos = new Set();
  for (const parte of String(tipo).split(",")) {
    const valor = parte.trim().toUpperCase();
    if (!valor) continue;
    if (ALIAS_TIPO[valor]) {
      ALIAS_TIPO[valor].forEach((t) => tipos.add(t));
    } else if (TIPOS_VALIDOS.has(valor)) {
      tipos.add(valor);
    } else {
      const err = new Error(`Tipo inválido: ${valor}`);
      err.code = "INVALID_TIPO";
      throw err;
    }
  }
  return tipos.size ? tipos : null;
}

/**
 * Cadastro completo de produtos, uma linha por cod_sku.
 * @param {string} [tipo] filtro opcional (CSV): ARMACOES, LENTES_GRAU,
 *   LENTES_CONTATO, ACESSORIOS, OUTROS, ou alias LENTES (= grau + contato).
 * @param {string|number} [limit] opcional — limita via ROWS n (diagnóstico
 *   e paginação simples; o sync normal não envia).
 */
async function getItensCadastro(tipo, limit) {
  const tiposFiltro = parseTipoParam(tipo);

  const ativoSelect = await resolveAtivoSelect();
  let sql = sqlItensCadastro.replace("/*__ATIVO_SELECT__*/", ativoSelect || "");

  if (limit !== undefined && limit !== null && String(limit).trim() !== "") {
    const n = Number(limit);
    if (!Number.isInteger(n) || n <= 0 || n > 500000) {
      const err = new Error(`limit inválido: ${limit}`);
      err.code = "INVALID_LIMIT";
      throw err;
    }
    sql = sql.replace("/*__ROWS__*/", `ROWS ${n}`);
  }

  const rows = await db.query(sql, []);

  if (!tiposFiltro) return rows;
  return rows.filter((row) => tiposFiltro.has(String(row.tipo || "").toUpperCase()));
}

module.exports = {
  getItensCadastro,
  parseTipoParam, // exportado para testes
};
