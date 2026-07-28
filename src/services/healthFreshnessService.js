// src/services/healthFreshnessService.js
//
// Frescor da copia do Firebird no servidor do bridge.
//
// Problema que resolve: o /health atual so faz ping de conexao. Se a copia
// diaria do banco parar de refletir dados novos, o Firebird continua
// conectando e respondendo SQL -- mas com dados velhos. Conectividade OK nao
// significa dados atualizados.
//
// Dois sinais, cada um pega um modo de falha diferente:
//
//   1) MON$DATABASE.MON$CREATION_DATE  -> QUANDO esta copia foi construida.
//      Como a copia diaria e feita por gbak (backup -> restore), avanca a
//      cada restore, independente de haver transacao no dia (imune a
//      feriado). Pega o caso do job de restore PARAR. Requer Firebird 3+.
//
//   2) MAX(transacao.dataemissao)      -> qual o dado mais novo DENTRO da copia.
//      Se a copia foi reconstruida hoje mas o dado mais novo e de dias atras,
//      a FONTE do backup esta parada mesmo com o restore rodando. Foi o caso
//      real observado: copia de hoje, dados congelados em 20/07.
//
// A defasagem entre (1) e (2) e o alarme robusto: um feriado da 1-2 dias de
// diferenca; uma fonte parada da defasagem crescente. Fallback gracioso: se
// um dos sinais falhar (ex.: Firebird < 3 sem MON$CREATION_DATE), o outro
// ainda responde; so vira 'indisponivel' se os dois falharem.

const path = require('path');
const fs = require('fs');
const db = require('../db');

const DEFAULT_MAX_LAG_DIAS = 2;
const DEFAULT_QUERY_TIMEOUT_MS = 5000;

function loadSql(fileName) {
  const filePath = path.join(__dirname, '..', '..', 'queries', 'health', fileName);
  return fs.readFileSync(filePath, 'utf8');
}

const sqlDataCriacao = loadSql('db_freshness.sql');
const sqlUltimaMovimentacao = loadSql('data_ultima_movimentacao.sql');

// Limite (em dias) a partir do qual consideramos desatualizado.
// Default 2 para absorver domingo/feriado sem falso alarme.
function maxLagDias() {
  const raw = Number(process.env.FRESHNESS_MAX_LAG_DIAS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_MAX_LAG_DIAS;
}

function queryTimeoutMs() {
  const raw = Number(process.env.FRESHNESS_QUERY_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_QUERY_TIMEOUT_MS;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function toDate(raw) {
  if (raw == null) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Diferenca em dias de calendario entre duas datas (truncada). Usa UTC para
// nao depender do fuso; diferencas de poucas horas nao mudam a contagem.
function diffDiasCalendario(maisRecente, maisAntiga) {
  const MS_DIA = 24 * 60 * 60 * 1000;
  const a = Date.UTC(maisRecente.getUTCFullYear(), maisRecente.getUTCMonth(), maisRecente.getUTCDate());
  const b = Date.UTC(maisAntiga.getUTCFullYear(), maisAntiga.getUTCMonth(), maisAntiga.getUTCDate());
  return Math.floor((a - b) / MS_DIA);
}

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

async function queryDataCriacao() {
  const rows = await withTimeout(db.query(sqlDataCriacao), queryTimeoutMs(), 'MON$CREATION_DATE');
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return toDate(row ? (row.creation_date ?? row.CREATION_DATE) : null);
}

async function queryDataDados() {
  const rows = await withTimeout(db.query(sqlUltimaMovimentacao), queryTimeoutMs(), 'MAX(transacao.dataemissao)');
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  return toDate(row ? (row.ultima ?? row.ULTIMA) : null);
}

async function getDbFreshness() {
  const checadoEm = new Date();
  const limite = maxLagDias();
  const avisos = [];

  let dataCopia = null;
  let dataDados = null;

  try {
    dataCopia = await queryDataCriacao();
  } catch (err) {
    avisos.push(`copia (MON$CREATION_DATE): ${err && err.message ? err.message : String(err)}`);
  }

  try {
    dataDados = await queryDataDados();
  } catch (err) {
    avisos.push(`dados (MAX transacao.dataemissao): ${err && err.message ? err.message : String(err)}`);
  }

  const base = {
    fontes: {
      copia: 'MON$CREATION_DATE',
      dados: 'MAX(transacao.dataemissao)',
    },
    data_copia: dataCopia ? ymd(dataCopia) : null,
    data_ultima_movimentacao: dataDados ? ymd(dataDados) : null,
    copia_lag_dias: null,
    dados_lag_dias: null,
    limite_dias: limite,
    checado_em: checadoEm.toISOString(),
    avisos,
  };

  // Nenhum sinal disponivel -> nao da para verificar.
  if (!dataCopia && !dataDados) {
    return { ...base, status: 'indisponivel', motivo_stale: null };
  }

  // Defasagem do job de restore: quantos dias desde que a copia foi construida.
  const copiaLag = dataCopia ? diffDiasCalendario(checadoEm, dataCopia) : null;

  // Defasagem dos dados: idealmente vs. a data da copia (imune a feriado);
  // sem a data da copia (Firebird antigo), cai para "hoje - dado" (sensivel
  // a feriado, mas melhor que nada).
  let dadosLag = null;
  let dadosLagBase = null;
  if (dataDados && dataCopia) {
    dadosLag = diffDiasCalendario(dataCopia, dataDados);
    dadosLagBase = 'data_copia';
  } else if (dataDados) {
    dadosLag = diffDiasCalendario(checadoEm, dataDados);
    dadosLagBase = 'hoje';
  }

  let status = 'fresh';
  let motivo = null;

  if (dataCopia && copiaLag > limite) {
    // O job de restore parou de rodar (a copia em si esta velha).
    status = 'stale';
    motivo = 'copia_parada';
  } else if (dadosLag != null && dadosLag > limite) {
    // O restore roda, mas a fonte do backup esta congelada (o caso observado).
    status = 'stale';
    motivo = 'dados_desatualizados';
  }

  return {
    ...base,
    status,
    motivo_stale: motivo,
    copia_lag_dias: copiaLag,
    dados_lag_dias: dadosLag,
    dados_lag_base: dadosLagBase,
  };
}

module.exports = { getDbFreshness };
