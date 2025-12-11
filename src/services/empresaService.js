// src/services/empresaService.js

const path = require('path');
const fs = require('fs');
const db = require('../db'); // src/db/index.js

function loadSQL(relativePath) {
  // __dirname = /app/src/services
  // ..        = /app/src
  // queries   = /app/src/queries
  console.log(path.join(__dirname, '..', '..', 'queries', 'empresas', fileName));
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Retorna as empresas já tratadas conforme regra de negócio:
 * - ignora empresas lixo (3,5,7,8,11,12)
 * - unifica SUPER (13 e 18 → 13, "DINIZ SUPER")
 *
 * Essa lógica deve estar no SQL:
 *   src/queries/empresas/listarEmpresas.sql
 *
 * Exemplo de SQL recomendado:
 *
 *   SELECT
 *     CASE
 *       WHEN e.cod_empresa IN (13,18) THEN 13
 *       ELSE e.cod_empresa
 *     END AS COD_EMPRESA,
 *     CASE
 *       WHEN e.cod_empresa IN (13,18) THEN 'DINIZ SUPER'
 *       ELSE p.nome
 *     END AS EMPRESA_NOME
 *   FROM empresa e
 *   JOIN pessoa p ON p.cod_pessoa = e.cod_empresa
 *   WHERE e.cod_empresa NOT IN (3,5,7,8,11,12)
 *   GROUP BY 1,2
 *   ORDER BY EMPRESA_NOME;
 */
async function getEmpresasRaw() {
  const sql = loadSQL('empresas/listarEmpresas.sql');
  const rows = await db.runQuery(sql, []);
  return rows;
}

/**
 * Normaliza o formato para uso interno em outros services.
 */
async function getEmpresasLogicas() {
  const rows = await getEmpresasRaw();

  return rows.map((r) => ({
    codEmpresa: r.COD_EMPRESA,
    empresaNome: r.EMPRESA_NOME,
  }));
}

/**
 * Usado pelo controller /api/v1/empresas
 * Retorna os mesmos campos em UPPERCASE que vêm da query.
 */
async function getEmpresas() {
  return getEmpresasRaw();
}

module.exports = {
  getEmpresas,
  getEmpresasLogicas,
};
