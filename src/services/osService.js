const path = require("path");
const fs = require("fs");
const db = require("../db");

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "os", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlMonitorOs = loadSql("monitor.sql");
const sqlMonitorOsUltimaEtapa = loadSql("monitor_ultima_etapa.sql");
const sqlHubReceitas = loadSql("hub_receitas.sql");
const OSL_TABLE_NAME = "ORDEMSERVICOOTICALENTE";
const OSL_JOIN_COLUMN_NAME = "COD_ORDEMSERVICOCAIXA";
const RECEITA_TABLE_NAME = "OTILJCLIENTERECEITA";
const RECEITA_MEDICO_COLUMN_NAME = "COD_MEDICO";
const RECEITA_OBSERVACAO_RECEITA_COLUMN_NAME = "OBSERVACAORECEITA";
const RECEITA_OBSERVACAO_COLUMN_NAME = "OBSERVACAO";
const PESSOA_TABLE_NAME = "PESSOA";
const PESSOA_CRM_COLUMN_NAME = "REGISTROPROFISSIONAL";
const ORDEMSERVICO_TABLE_NAME = "ORDEMSERVICO";
const ORDEMSERVICO_OBS_RECEITA_COLUMN_NAME = "OBS_RECEITA";
const ORDEMSERVICO_OBSERVACAO_RECEITA_COLUMN_NAME = "OBSERVACAO_RECEITA";
const oslJoinPattern =
  /OSL\.COD_ORDEMSERVICOCAIXA\s*=\s*OCX\.COD_ORDEMSERVICOCAIXA/i;
const medicoSelectPattern =
  /\s*pm\.nome\s+AS medico,\n\s*pm\.registroprofissional\s+AS crm,\n/i;
const medicoJoinPattern = /\s*LEFT JOIN pessoa pm\s*\n\s*ON pm\.cod_pessoa = ocr\.cod_medico\s*\n/i;
const obsReceitaColumnPattern = /os\.observacao_receita/gi;
const obsReceitaSelectPattern = /\s*os\.observacao_receita\s+AS observacao_receita_os,\n/i;
const obsReceitaMergedPattern = /\s*COALESCE\(os\.observacao_receita, ocr\.observacaoreceita\)\n\s+AS observacao_receita,\n/i;
const receitaCadastroObsPattern = /COALESCE\(ocr\.observacaoreceita,\s*ocr\.observacao\)\n\s+AS observacao_receita_cadastro,/gi;
const receitaConsolidadaObsPattern = /COALESCE\(os\.observacao_receita,\s*os\.obs_receita,\s*ocr\.observacaoreceita,\s*ocr\.observacao\)\n\s+AS observacao_receita,/gi;
const receitaCadastroObservacaoColumnPattern = /ocr\.observacao/gi;
const sqlHubReceitasFallback = sqlHubReceitas.replace(
  oslJoinPattern,
  "osl.cod_transacao = ocx.cod_transacao"
);
const sqlHubReceitasSemMedico = sqlHubReceitas
  .replace(
    medicoSelectPattern,
    "    CAST(NULL AS VARCHAR(120))      AS medico,\n    CAST(NULL AS VARCHAR(60))       AS crm,\n"
  )
  .replace(medicoJoinPattern, "");
const sqlHubReceitasFallbackSemMedico = sqlHubReceitasFallback
  .replace(
    medicoSelectPattern,
    "    CAST(NULL AS VARCHAR(120))      AS medico,\n    CAST(NULL AS VARCHAR(60))       AS crm,\n"
  )
  .replace(medicoJoinPattern, "");
const sqlHubReceitasObsObservacaoReceita = sqlHubReceitas.replace(
  obsReceitaColumnPattern,
  "os.obs_receita"
);
const sqlHubReceitasFallbackObsObservacaoReceita = sqlHubReceitasFallback.replace(
  obsReceitaColumnPattern,
  "os.obs_receita"
);
const sqlHubReceitasSemObsReceitaOs = sqlHubReceitas
  .replace(
    obsReceitaSelectPattern,
    "    CAST(NULL AS VARCHAR(1000))     AS observacao_receita_os,\n"
  )
  .replace(
    obsReceitaMergedPattern,
    "    ocr.observacaoreceita          AS observacao_receita,\n"
  );
const sqlHubReceitasFallbackSemObsReceitaOs = sqlHubReceitasFallback
  .replace(
    obsReceitaSelectPattern,
    "    CAST(NULL AS VARCHAR(1000))     AS observacao_receita_os,\n"
  )
  .replace(
    obsReceitaMergedPattern,
    "    ocr.observacaoreceita          AS observacao_receita,\n"
  );
const hasFallbackJoin = sqlHubReceitasFallback !== sqlHubReceitas;
const hasFallbackMedico = sqlHubReceitasSemMedico !== sqlHubReceitas;
const hasFallbackObsReceitaOs = sqlHubReceitasSemObsReceitaOs !== sqlHubReceitas;
const fallbackJoinErrorMessage = `Join condition matching pattern ${oslJoinPattern} not found in hub_receitas.sql.`;
const fallbackMedicoErrorMessage = `Expected medico select/join patterns not found in hub_receitas.sql.`;
const fallbackObsReceitaErrorMessage = `Expected observacao_receita patterns not found in hub_receitas.sql.`;
// Disable caching with DISABLE_METADATA_CACHE=true; tests skip cache for isolation.
const enableMetadataCache =
  process.env.DISABLE_METADATA_CACHE !== "true" &&
  process.env.NODE_ENV !== "test";
// Schema changes require an application restart to refresh this cache.
let cachedHasOslCodOrdemServicoCaixa = null;
let cachedHasReceitaMedicoColumns = null;
let cachedOrdemServicoObsReceitaColumn = null;
let cachedReceitaCadastroObsColumn = null;
const columnLookupCache = new Map();

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

async function hasOslCodOrdemServicoCaixa() {
  if (enableMetadataCache && cachedHasOslCodOrdemServicoCaixa !== null) {
    return cachedHasOslCodOrdemServicoCaixa;
  }

  try {
    const hasColumnResult = await hasColumn(OSL_TABLE_NAME, OSL_JOIN_COLUMN_NAME);
    if (enableMetadataCache) {
      cachedHasOslCodOrdemServicoCaixa = hasColumnResult;
    }
    return hasColumnResult;
  } catch (err) {
    throw new Error(
      `Metadata lookup failed for ${OSL_TABLE_NAME}.${OSL_JOIN_COLUMN_NAME}: ${err.message}`
    );
  }
}

async function hasReceitaMedicoColumns() {
  if (enableMetadataCache && cachedHasReceitaMedicoColumns !== null) {
    return cachedHasReceitaMedicoColumns;
  }

  try {
    const [hasCodMedico, hasRegistroProfissional] = await Promise.all([
      hasColumn(RECEITA_TABLE_NAME, RECEITA_MEDICO_COLUMN_NAME),
      hasColumn(PESSOA_TABLE_NAME, PESSOA_CRM_COLUMN_NAME),
    ]);
    const hasColumns = hasCodMedico && hasRegistroProfissional;
    if (enableMetadataCache) {
      cachedHasReceitaMedicoColumns = hasColumns;
    }
    return hasColumns;
  } catch (err) {
    throw new Error(
      `Metadata lookup failed for ${RECEITA_TABLE_NAME}.${RECEITA_MEDICO_COLUMN_NAME} or ${PESSOA_TABLE_NAME}.${PESSOA_CRM_COLUMN_NAME}: ${err.message}`
    );
  }
}

async function resolveOrdemServicoObsReceitaColumn() {
  if (enableMetadataCache && cachedOrdemServicoObsReceitaColumn !== null) {
    return cachedOrdemServicoObsReceitaColumn;
  }

  try {
    const [hasObsReceita, hasObservacaoReceita] = await Promise.all([
      hasColumn(ORDEMSERVICO_TABLE_NAME, ORDEMSERVICO_OBS_RECEITA_COLUMN_NAME),
      hasColumn(ORDEMSERVICO_TABLE_NAME, ORDEMSERVICO_OBSERVACAO_RECEITA_COLUMN_NAME),
    ]);

    let resolvedColumn = null;
    if (hasObservacaoReceita) {
      resolvedColumn = ORDEMSERVICO_OBSERVACAO_RECEITA_COLUMN_NAME;
    } else if (hasObsReceita) {
      resolvedColumn = ORDEMSERVICO_OBS_RECEITA_COLUMN_NAME;
    }

    if (enableMetadataCache) {
      cachedOrdemServicoObsReceitaColumn = resolvedColumn;
    }
    return resolvedColumn;
  } catch (err) {
    throw new Error(
      `Metadata lookup failed for ${ORDEMSERVICO_TABLE_NAME}.${ORDEMSERVICO_OBS_RECEITA_COLUMN_NAME} or ${ORDEMSERVICO_TABLE_NAME}.${ORDEMSERVICO_OBSERVACAO_RECEITA_COLUMN_NAME}: ${err.message}`
    );
  }
}


async function resolveReceitaCadastroObsColumn() {
  if (enableMetadataCache && cachedReceitaCadastroObsColumn !== null) {
    return cachedReceitaCadastroObsColumn;
  }

  try {
    const [hasObservacaoReceita, hasObservacao] = await Promise.all([
      hasColumn(RECEITA_TABLE_NAME, RECEITA_OBSERVACAO_RECEITA_COLUMN_NAME),
      hasColumn(RECEITA_TABLE_NAME, RECEITA_OBSERVACAO_COLUMN_NAME),
    ]);

    let resolvedColumn = null;
    if (hasObservacaoReceita) {
      resolvedColumn = RECEITA_OBSERVACAO_RECEITA_COLUMN_NAME;
    } else if (hasObservacao) {
      resolvedColumn = RECEITA_OBSERVACAO_COLUMN_NAME;
    }

    if (enableMetadataCache) {
      cachedReceitaCadastroObsColumn = resolvedColumn;
    }
    return resolvedColumn;
  } catch (err) {
    throw new Error(
      `Metadata lookup failed for ${RECEITA_TABLE_NAME}.${RECEITA_OBSERVACAO_RECEITA_COLUMN_NAME} or ${RECEITA_TABLE_NAME}.${RECEITA_OBSERVACAO_COLUMN_NAME}: ${err.message}`
    );
  }
}

function applyReceitaCadastroFallback(sql, receitaCadastroObsColumn) {
  if (receitaCadastroObsColumn === RECEITA_OBSERVACAO_RECEITA_COLUMN_NAME) {
    return sql
      .replace(receitaCadastroObsPattern, 'ocr.observacaoreceita          AS observacao_receita_cadastro,')
      .replace(receitaConsolidadaObsPattern, 'COALESCE(os.observacao_receita, os.obs_receita, ocr.observacaoreceita)\n                                   AS observacao_receita,')
      .replace(receitaCadastroObservacaoColumnPattern, 'ocr.observacaoreceita');
  }

  if (receitaCadastroObsColumn === RECEITA_OBSERVACAO_COLUMN_NAME) {
    return sql
      .replace(receitaCadastroObsPattern, 'ocr.observacao                 AS observacao_receita_cadastro,')
      .replace(receitaConsolidadaObsPattern, 'COALESCE(os.observacao_receita, os.obs_receita, ocr.observacao)\n                                   AS observacao_receita,')
      .replace(/ocr\.observacaoreceita/gi, 'ocr.observacao');
  }

  return sql
    .replace(receitaCadastroObsPattern, 'CAST(NULL AS VARCHAR(1000))     AS observacao_receita_cadastro,')
    .replace(receitaConsolidadaObsPattern, 'COALESCE(os.observacao_receita, os.obs_receita)\n                                   AS observacao_receita,')
    .replace(/ocr\.observacaoreceita/gi, 'CAST(NULL AS VARCHAR(1000))');
}

function applyMedicoFallback(sql, includeMedicoColumns) {
  if (includeMedicoColumns) {
    return sql;
  }

  return sql
    .replace(
      medicoSelectPattern,
      "    CAST(NULL AS VARCHAR(120))      AS medico,\n    CAST(NULL AS VARCHAR(60))       AS crm,\n"
    )
    .replace(medicoJoinPattern, "");
}

async function getMonitorOs({ dataInicio, dataFim, codEmpresa }) {
  const empresaParam = codEmpresa ?? null;
  const params = [dataInicio, dataFim, empresaParam, empresaParam];
  return db.query(sqlMonitorOs, params);
}

async function getMonitorOsUltimaEtapa({ dataInicio, dataFim, codEmpresa }) {
  const empresaParam = codEmpresa ?? null;
  const params = [dataInicio, dataFim, empresaParam, empresaParam];
  return db.query(sqlMonitorOsUltimaEtapa, params);
}

async function getHubReceitas({ dataInicio, dataFim, codEmpresa, os }) {
  const empresaParam = codEmpresa ?? null;
  const osParam = os ?? null;
  const params = [osParam, osParam, dataInicio, dataFim, empresaParam, empresaParam];
  const [useCodOs, includeMedicoColumns, ordemServicoObsReceitaColumn, receitaCadastroObsColumn] = await Promise.all([
    hasOslCodOrdemServicoCaixa(),
    hasReceitaMedicoColumns(),
    resolveOrdemServicoObsReceitaColumn(),
    resolveReceitaCadastroObsColumn(),
  ]);

  if (!useCodOs && !hasFallbackJoin) {
    throw new Error(fallbackJoinErrorMessage);
  }
  if (!includeMedicoColumns && !hasFallbackMedico) {
    throw new Error(fallbackMedicoErrorMessage);
  }
  if (!ordemServicoObsReceitaColumn && !hasFallbackObsReceitaOs) {
    throw new Error(fallbackObsReceitaErrorMessage);
  }

  const baseSql = useCodOs || !hasFallbackJoin ? sqlHubReceitas : sqlHubReceitasFallback;
  const fallbackSemObsSql =
    useCodOs || !hasFallbackJoin
      ? sqlHubReceitasSemObsReceitaOs
      : sqlHubReceitasFallbackSemObsReceitaOs;
  const fallbackObsSql =
    useCodOs || !hasFallbackJoin
      ? sqlHubReceitasObsObservacaoReceita
      : sqlHubReceitasFallbackObsObservacaoReceita;

  let sql = baseSql;
  if (ordemServicoObsReceitaColumn === ORDEMSERVICO_OBS_RECEITA_COLUMN_NAME) {
    sql = fallbackObsSql;
  } else if (!ordemServicoObsReceitaColumn) {
    sql = fallbackSemObsSql;
  }

  sql = applyReceitaCadastroFallback(sql, receitaCadastroObsColumn);

  const attempts = [];
  const pushAttempt = (candidateSql) => {
    const withReceitaFallback = applyReceitaCadastroFallback(candidateSql, receitaCadastroObsColumn);
    const finalSql = applyMedicoFallback(withReceitaFallback, includeMedicoColumns);
    if (!attempts.includes(finalSql)) {
      attempts.push(finalSql);
    }
  };

  pushAttempt(sql);
  pushAttempt(sql.replace(/os\.observacao_receita/gi, "os.obs_receita"));
  pushAttempt(sql.replace(/os\.obs_receita/gi, "os.observacao_receita"));
  pushAttempt(sql.replace(/osl\.observacao/gi, "osl.obs"));
  pushAttempt(sql.replace(/COALESCE\(osl\.observacao,\s*ocx\.observacao\)/gi, "ocx.observacao"));
  pushAttempt(fallbackSemObsSql);

  let lastError = null;
  for (const candidateSql of attempts) {
    try {
      return await db.query(candidateSql, params);
    } catch (err) {
      const msg = (err && err.message ? err.message : "").toUpperCase();
      const isUnknownObsColumn =
        msg.includes("COLUMN UNKNOWN") &&
        (
          msg.includes("OBS_RECEITA") ||
          msg.includes("OBSERVACAO_RECEITA") ||
          msg.includes("OSL.OBS") ||
          msg.includes("OSL.OBSERVACAO") ||
          msg.includes("OCR.OBS") ||
          msg.includes("OCR.OBSERVACAO") ||
          msg.includes("OBSERVACAORECEITA")
        );

      if (!isUnknownObsColumn) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError;
}

async function getHubReceitasCompleto({ os, codEmpresa }) {
  const empresaParam = codEmpresa ?? null;
  const osRows = await db.query(
    `
      SELECT *
      FROM ordemservicocaixa
      WHERE numeroordemservico = CAST(? AS INTEGER)
        AND ( ? IS NULL OR cod_empresaorigem = CAST(? AS INTEGER) )
    `,
    [os, empresaParam, empresaParam]
  );

  if (osRows.length === 0) {
    return {
      ordem_servico: null,
      receita_otica: [],
      receita_lente: [],
      receita_otica_lente: [],
    };
  }

  const osRow = osRows[0];
  const codOs = osRow.cod_ordemservicocaixa;
  const codTransacao = osRow.cod_transacao;

  const receitaOtica = await db.query(
    `SELECT * FROM otiordemservicootica WHERE cod_ordemservicocaixa = ?`,
    [codOs]
  );

  const receitaLente = await db.query(
    `SELECT * FROM ordemservicooticalente WHERE cod_transacao = ?`,
    [codTransacao]
  );

  const receitaOticaLente = await db.query(
    `SELECT * FROM otiordemservicootica_lente WHERE cod_transacao = ?`,
    [codTransacao]
  );

  return {
    ordem_servico: osRow,
    receita_otica: receitaOtica,
    receita_lente: receitaLente,
    receita_otica_lente: receitaOticaLente,
  };
}

async function getReceitaMetadata({ campos, chavesOs, includeAllFields }) {
  const camposUpper = campos
    .map((campo) => String(campo || "").trim())
    .filter(Boolean)
    .map((campo) => campo.toUpperCase());

  const chavesOsUpper = chavesOs
    .map((campo) => String(campo || "").trim())
    .filter(Boolean)
    .map((campo) => campo.toUpperCase());

  const lookupFields = [...new Set([...camposUpper, ...chavesOsUpper])];

  if (lookupFields.length === 0) {
    return { matches: [], fieldsByTable: null };
  }

  const placeholders = lookupFields.map(() => "?").join(", ");
  const sql = `
    SELECT
      TRIM(rf.rdb$relation_name) AS tabela,
      TRIM(rf.rdb$field_name) AS campo
    FROM rdb$relation_fields rf
    JOIN rdb$relations r
      ON r.rdb$relation_name = rf.rdb$relation_name
    WHERE r.rdb$system_flag = 0
      AND UPPER(rf.rdb$field_name) IN (${placeholders})
    ORDER BY tabela, campo
  `;

  const matches = await db.query(sql, lookupFields);

  if (!includeAllFields || matches.length === 0) {
    return { matches, fieldsByTable: null };
  }

  const tabelas = [...new Set(matches.map((row) => row.tabela))];
  const tablePlaceholders = tabelas.map(() => "?").join(", ");
  const sqlFields = `
    SELECT
      TRIM(rf.rdb$relation_name) AS tabela,
      TRIM(rf.rdb$field_name) AS campo
    FROM rdb$relation_fields rf
    JOIN rdb$relations r
      ON r.rdb$relation_name = rf.rdb$relation_name
    WHERE r.rdb$system_flag = 0
      AND rf.rdb$relation_name IN (${tablePlaceholders})
    ORDER BY tabela, campo
  `;

  const fieldsRows = await db.query(sqlFields, tabelas);
  const fieldsByTable = fieldsRows.reduce((acc, row) => {
    if (!acc[row.tabela]) {
      acc[row.tabela] = [];
    }
    acc[row.tabela].push(row.campo);
    return acc;
  }, {});

  return { matches, fieldsByTable };
}

module.exports = {
  getMonitorOs,
  getMonitorOsUltimaEtapa,
  getHubReceitas,
  getHubReceitasCompleto,
  getReceitaMetadata,
};
