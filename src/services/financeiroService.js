// src/services/financeiroService.js

const path = require('path');
const fs = require('fs');
const db = require('../db');

// Empresas que nunca entram (lixo)
const EMPRESAS_LIXO = new Set([3, 5, 7, 8, 11, 12]);

// Para empresa=ALL -> vamos usar essa lista lógica.
// 13 já cobre 13 e 18 por causa da regra da SQL.
// (Se quiser, pode ajustar essa lista depois.)
const EMPRESAS_ALL_LOGICAS = [1, 2, 4, 6, 9, 13, 14, 15, 16, 17];

/**
 * Carrega SQL da pasta /app/queries/financeiro
 *
 * __dirname = /app/src/services
 * ..        = /app/src
 * ..        = /app
 * queries/financeiro = /app/queries/financeiro
 */
function loadSql(filename) {
  const filePath = path.join(__dirname, '..', '..', 'queries', 'financeiro', filename);

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`[FINANCEIRO] SQL FILE NOT FOUND: ${filePath}`);
    throw err;
  }
}

const SQL_PARCELAS = loadSql('financeiro_parcelas.sql');

/**
 * Converte "1, 9,13" -> [1, 9, 13]
 */
function parseEmpresasLista(empresaStr) {
  if (!empresaStr) return [];

  return Array.from(
    new Set(
      empresaStr
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n))
    )
  );
}

/**
 * Consulta a SQL de parcelas PARA UMA empresa.
 *
 * Ordem dos parâmetros:
 *   1) cod_empresa
 *   2) cod_empresa (de novo, para o trecho do 13/18)
 *   3) dataInicio
 *   4) dataFim
 */
async function getParcelasPorEmpresa(codEmpresa, dataInicio, dataFim) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim];
  return db.runQuery(SQL_PARCELAS, params);
}

/**
 * API principal chamada pelo controller.
 *
 * Regras:
 *  - empresa ausente ou "ALL"        -> EMPRESAS_ALL_LOGICAS
 *  - empresa = "1"                   -> só empresa 1
 *  - empresa = "1,9,13"              -> 1, 9, 13 (ignorando lixo)
 *
 * A SQL continua responsável por:
 *  - ignorar empresas lixo (3,5,7,8,11,12)
 *  - unificar 13/18 como "empresa_cod_logico = 13"
 */
async function getParcelas({ empresa, dataInicio, dataFim }) {
  const empRaw = (empresa || '').trim();

  // ---------------------------------------------------------------------------
  // CASO 1: empresa ausente ou ALL -> varre lista padrão
  // ---------------------------------------------------------------------------
  if (!empRaw || empRaw.toUpperCase() === 'ALL') {
    let allRows = [];

    for (const cod of EMPRESAS_ALL_LOGICAS) {
      try {
        const rows = await getParcelasPorEmpresa(cod, dataInicio, dataFim);
        if (rows && rows.length > 0) {
          allRows = allRows.concat(rows);
        }
      } catch (err) {
        console.error(
          `[FINANCEIRO] Erro ao buscar parcelas (ALL) para empresa ${cod}:`,
          err.message || err
        );
        // continua nas demais
      }
    }

    return allRows;
  }

  // ---------------------------------------------------------------------------
  // CASO 2: empresa explícita (1 ou lista "1,9,13")
  // ---------------------------------------------------------------------------
  const cods = parseEmpresasLista(empRaw);

  if (cods.length === 0) {
    // Parâmetro empresa veio, mas não deu pra parsear nada útil
    return [];
  }

  let allRows = [];

  for (const cod of cods) {
    // pula lixo já aqui, pra evitar chamadas desnecessárias
    if (EMPRESAS_LIXO.has(cod)) {
      continue;
    }

    try {
      const rows = await getParcelasPorEmpresa(cod, dataInicio, dataFim);
      if (rows && rows.length > 0) {
        allRows = allRows.concat(rows);
      }
    } catch (err) {
      console.error(
        `[FINANCEIRO] Erro ao buscar parcelas para empresa ${cod}:`,
        err.message || err
      );
    }
  }

  return allRows;
}

// Deixo o DRE como stub por enquanto; você pode manter
// sua implementação antiga aqui, se já estiver funcionando.
async function getDre(params) {
  throw new Error('getDre ainda não foi reimplementado neste arquivo.');
}

module.exports = {
  getParcelas,
  getDre,
};
