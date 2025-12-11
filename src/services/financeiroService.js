// src/services/financeiroService.js

const path = require('path');
const fs = require('fs');
const db = require('../db');
const empresaService = require('./empresaService');

/**
 * Carrega SQL da pasta /app/queries/financeiro
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
 * Normaliza lista de empresas a partir da querystring.
 * Ex.: "1, 9,13" -> [1,9,13]
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
 * Extrai campo independente de maiúsculo/alias.
 */
function getField(row, candidates) {
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, c)) {
      return row[c];
    }
  }
  return undefined;
}

/**
 * Calcula o "código lógico" da empresa para uma linha:
 * - 3,5,7,8,11,12 -> lixo (retorna null)
 * - 13/18 -> 13  (DINIZ SUPER)
 * - demais -> o próprio código
 */
function getEmpresaLogicaFromRow(row) {
  const lixo = new Set([3, 5, 7, 8, 11, 12]);

  const codOriginal = Number(
    getField(row, ['EMPRESA_COD_LOGICO', 'EMPRESA_CODIGO_LOGICO', 'EMPRESA_CODIGO', 'COD_EMPRESA', 'COD_EMPRESA_LOGICO'])
  );

  // Se não achar cod_logico, tenta cod_empresa normal:
  const cod = !Number.isNaN(codOriginal) && codOriginal
    ? codOriginal
    : Number(getField(row, ['COD_EMPRESA']));

  if (!cod || Number.isNaN(cod)) return null;
  if (lixo.has(cod)) return null;

  if (cod === 13 || cod === 18) return 13;
  return cod;
}

/**
 * Principal: busca parcelas, filtrando empresas no NODE.
 *
 * Regras:
 *  - empresa ausente ou "ALL"        -> todas empresas (menos lixo), com SUPER unificada
 *  - empresa = "1"                   -> só empresa lógica 1
 *  - empresa = "1,9,13"              -> empresas lógicas 1, 9 e 13
 */
async function getParcelas({ empresa, dataInicio, dataFim }) {
  // 1) Busca bruto: SQL só filtra por data + remove lixo
  const params = [dataInicio, dataFim];
  const rows = await db.runQuery(SQL_PARCELAS, params);

  if (!rows || rows.length === 0) {
    return [];
  }

  const empRaw = (empresa || '').trim().toUpperCase();

  // 2) Calcula empresa lógica de cada linha
  const enriched = rows
    .map((row) => {
      const codLogico = getEmpresaLogicaFromRow(row);
      if (codLogico == null) return null;

      // nome lógico se vier da SQL, senão tenta nome normal
      const nomeLogico =
        getField(row, ['EMPRESA_NOME_LOGICO', 'EMPRESA_NOME']) || null;

      return {
        ...row,
        EMPRESA_COD_LOGICO: codLogico,
        EMPRESA_NOME_LOGICO: nomeLogico,
      };
    })
    .filter(Boolean);

  if (!empRaw || empRaw === 'ALL') {
    // Retorna tudo já enriquecido
    return enriched;
  }

  // 3) Se veio uma lista explícita (ex.: "1,9,13"), filtra nela
  const lista = parseEmpresasLista(empRaw);
  if (lista.length === 0) {
    // Nenhum código válido na lista; melhor retornar vazio
    return [];
  }

  const set = new Set(lista);

  const filtrado = enriched.filter((row) =>
    set.has(Number(row.EMPRESA_COD_LOGICO))
  );

  return filtrado;
}

// DRE: mantém como está, ou implementamos depois com a mesma lógica de ALL
async function getDre(params) {
  throw new Error('getDre ainda não foi reimplementado neste arquivo.');
}

module.exports = {
  getParcelas,
  getDre,
};
