// src/services/healthFreshnessService.js
//
// Frescor da copia do Firebird no servidor do bridge.
//
// Problema que resolve: o /health atual so faz ping de conexao. Se a copia
// diaria do banco parar de ser atualizada, o Firebird continua conectando e
// respondendo SQL normalmente -- mas com dados velhos. Conectividade OK nao
// significa dados atualizados.
//
// Sinal usado: MON$DATABASE.MON$CREATION_DATE, a data em que ESTA copia foi
// criada. Como a copia diaria e feita por gbak (backup -> restore), esse
// campo avanca a cada restore, independente de haver transacao no dia
// (resolve o caso do feriado sem venda). Requer Firebird 3+.
//
// Fallback gracioso: se a coluna nao existir (Firebird antigo) ou a query
// falhar, devolve status 'indisponivel' em vez de quebrar.

const path = require('path');
const fs = require('fs');
const db = require('../db');

const DEFAULT_MAX_LAG_DIAS = 2;

function loadSql(fileName) {
  const filePath = path.join(__dirname, '..', '..', 'queries', 'health', fileName);
  return fs.readFileSync(filePath, 'utf8');
}

const sqlDbFreshness = loadSql('db_freshness.sql');

// Limite (em dias) a partir do qual a copia e considerada desatualizada.
// Default 2 para absorver domingo/feriado sem falso alarme.
function maxLagDias() {
  const raw = Number(process.env.FRESHNESS_MAX_LAG_DIAS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_MAX_LAG_DIAS;
}

// Diferenca em dias de calendario entre duas datas (truncada). Usa UTC para
// nao depender do fuso; diferencas de poucas horas nao mudam a contagem.
function diffDiasCalendario(agora, dataCopia) {
  const MS_DIA = 24 * 60 * 60 * 1000;
  const a = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate());
  const b = Date.UTC(dataCopia.getUTCFullYear(), dataCopia.getUTCMonth(), dataCopia.getUTCDate());
  return Math.floor((a - b) / MS_DIA);
}

async function getDbFreshness() {
  const checadoEm = new Date();
  const limite = maxLagDias();

  try {
    const rows = await db.query(sqlDbFreshness);
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    const raw = row ? (row.creation_date ?? row.CREATION_DATE) : null;

    if (!raw) {
      return {
        status: 'desconhecido',
        fonte: 'MON$CREATION_DATE',
        motivo: 'MON$DATABASE nao retornou data de criacao',
        limite_dias: limite,
        checado_em: checadoEm.toISOString(),
      };
    }

    const dataCopia = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(dataCopia.getTime())) {
      return {
        status: 'desconhecido',
        fonte: 'MON$CREATION_DATE',
        motivo: `data de criacao invalida: ${String(raw)}`,
        limite_dias: limite,
        checado_em: checadoEm.toISOString(),
      };
    }

    const lag = diffDiasCalendario(checadoEm, dataCopia);
    const status = lag > limite ? 'stale' : 'fresh';

    return {
      status,
      fonte: 'MON$CREATION_DATE',
      data_copia: dataCopia.toISOString().slice(0, 10),
      data_copia_iso: dataCopia.toISOString(),
      lag_dias: lag,
      limite_dias: limite,
      checado_em: checadoEm.toISOString(),
    };
  } catch (err) {
    // Firebird < 3 nao tem MON$CREATION_DATE -> a query lanca erro aqui.
    return {
      status: 'indisponivel',
      fonte: 'MON$CREATION_DATE',
      motivo: err && err.message ? err.message : String(err),
      limite_dias: limite,
      checado_em: checadoEm.toISOString(),
    };
  }
}

module.exports = { getDbFreshness };
