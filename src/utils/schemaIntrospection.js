// src/utils/schemaIntrospection.js
//
// Helpers de introspecção de schema do Firebird (rdb$relation_fields),
// usados para checar em runtime a existência de tabelas/colunas e podar
// trechos de SQL com fallback gracioso (padrão da casa; ver crmService.js
// e osService.js, que mantêm implementações locais equivalentes).
const db = require("../db");

// Cache de metadados (schema só muda com restart da aplicação).
// Desligado em testes para permitir mocks independentes.
const enableMetadataCache = process.env.NODE_ENV !== "test";
const columnLookupCache = new Map();

/**
 * Verifica se uma coluna existe em uma tabela do Firebird
 * consultando o catálogo de sistema rdb$relation_fields.
 *
 * @param {string} tableName  nome da tabela (MAIÚSCULAS, sem aspas)
 * @param {string} columnName nome da coluna (MAIÚSCULAS, sem aspas)
 * @returns {Promise<boolean>}
 */
async function hasColumn(tableName, columnName) {
  const cacheKey = `${tableName}.${columnName}`;
  if (enableMetadataCache && columnLookupCache.has(cacheKey)) {
    return columnLookupCache.get(cacheKey);
  }

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

  const exists = rows.length > 0;
  if (enableMetadataCache) {
    columnLookupCache.set(cacheKey, exists);
  }
  return exists;
}

/**
 * Verifica se uma tabela (não-sistema) existe no schema.
 *
 * @param {string} tableName nome da tabela (MAIÚSCULAS, sem aspas)
 * @returns {Promise<boolean>}
 */
async function hasTable(tableName) {
  const cacheKey = `${tableName}.*`;
  if (enableMetadataCache && columnLookupCache.has(cacheKey)) {
    return columnLookupCache.get(cacheKey);
  }

  const rows = await db.query(
    `
      SELECT 1
      FROM rdb$relations r
      WHERE r.rdb$system_flag = 0
        AND TRIM(r.rdb$relation_name) = ?
    `,
    [tableName]
  );

  const exists = rows.length > 0;
  if (enableMetadataCache) {
    columnLookupCache.set(cacheKey, exists);
  }
  return exists;
}

module.exports = {
  hasColumn,
  hasTable,
};
