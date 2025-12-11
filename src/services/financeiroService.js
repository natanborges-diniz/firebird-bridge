// src/services/financeiroService.js

const path = require('path');
const fs = require('fs');
const db = require('../db');
const empresaService = require('./empresaService'); // mesma pasta

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

// -----------------------------------------------------------------------------
// SQLs
// -----------------------------------------------------------------------------
const SQL_PARCELAS = loadSql('financeiro_parcelas.sql');
// Se tiver DRE depois podemos reaproveitar o mesmo padrão:
// const SQL_DRE = loadSql('financeiro_dre.sql');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Faz a query de parcelas PARA UMA EMPRESA física (um código só).
 *
 * A SQL espera os parâmetros nesta ordem:
 *   1) cod_empresa (para fl.cod_empresa = ?)
 *   2) cod_empresa (para o caso especial 13/18)
 *   3) dataInicio
 *   4) dataFim
 */
async function getParcelasPorEmpresa(codEmpresa, dataInicio, dataFim) {
  const params = [codEmpresa, codEmpresa, dataInicio, dataFim];
  return db.runQuery(SQL_PARCELAS, params);
}

/**
 * Normaliza string de empresas em lista de inteiros únicos.
 *
 * Ex:
 *   "1, 9,13" -> [1, 9, 13]
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

// -----------------------------------------------------------------------------
// API pública usada pelo controller
// -----------------------------------------------------------------------------

/**
 * getParcelas
 *
 * Regras:
 * - empresa = "ALL" ou ausente  -> todas empresas lógicas (exceto lixo),
 *   cada uma consultada com a SQL atual.
 * - empresa = "1"               -> só empresa 1.
 * - empresa = "1,9,13"          -> empresas 1, 9 e 13.
 *
 * A lógica de "DINIZ SUPER" (13 / 18) continua na PRÓPRIA SQL
 * (aqueles dois ? para cod_empresa), não precisamos duplicar aqui.
 */
async function getParcelas({ empresa, dataInicio, dataFim }) {
  const empRaw = (empresa || '').trim();

  // ---------------------------------------------------------------------------
  // CASO 1: uma ou várias empresas explícitas na query (?empresa=1,9,13)
  // ---------------------------------------------------------------------------
  if (empRaw && empRaw.toUpperCase() !== 'ALL') {
    const cods = parseEmpresasLista(empRaw);

    if (cods.length === 0) {
      // Nada parseável, não vamos quebrar a API, apenas não retorna linhas
      return [];
    }

    let allRows = [];

    for (const cod of cods) {
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
        // continua nas demais empresas
      }
    }

    return allRows;
  }

  // ---------------------------------------------------------------------------
  // CASO 2: empresa = "ALL" (ou não veio nada) -> TODAS empresas lógicas
  // ---------------------------------------------------------------------------
  let empresasLogicas = [];
  try {
    empresasLogicas = await empresaService.getEmpresasLogicas();
  } catch (err) {
    console.error('[FINANCEIRO] Erro ao buscar empresas lógicas:', err.message || err);
    // se não conseguir listar empresas, melhor retornar vazio do que quebrar tudo
    return [];
  }

  const codsLogicos = empresasLogicas.map((e) => e.codEmpresa);
  const codsUnicos = Array.from(new Set(codsLogicos));

  let allRows = [];

  for (const cod of codsUnicos) {
    try {
      const rows = await getParcelasPorEmpresa(cod, dataInicio, dataFim);
      if (rows && rows.length > 0) {
        allRows = allRows.concat(rows);
      }
    } catch (err) {
      console.error(
        `[FINANCEIRO] Erro ao buscar parcelas para empresa lógica ${cod}:`,
        err.message || err
      );
    }
  }

  return allRows;
}

// -----------------------------------------------------------------------------
// (Opcional) DRE pode ficar com a assinatura anterior, se já estiver funcionando.
// Aqui deixo apenas o esqueleto, sem mexer:
// -----------------------------------------------------------------------------

async function getDre(params) {
  // Mantém sua implementação atual de DRE, se já estiver ok.
  // Se você quiser, depois fazemos o mesmo esquema de ALL / múltiplas empresas aqui.
  throw new Error('getDre ainda não foi reimplementado neste arquivo.');
}

module.exports = {
  getParcelas,
  getDre,
};
