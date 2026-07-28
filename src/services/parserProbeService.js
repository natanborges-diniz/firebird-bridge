// src/services/parserProbeService.js
//
// TEMPORARIO (Fase 1): sondas de parser contra o Firebird real para
// diagnosticar o erro "-104 Token unknown" das queries de recebimentos.
// Todas as sondas sao HARDCODED (nada vem do request). Remover apos o
// diagnostico. GET /api/v1/vendas/recebimentos/probe-parser
const fs = require("fs");
const path = require("path");
const db = require("../db");
const { filtroVendaRegularSql } = require("../utils/vendaRegular");

function loadSql(filename) {
  return fs.readFileSync(
    path.join(__dirname, "..", "..", "queries", "vendas", filename),
    "utf8"
  );
}

function semComentarios(sql) {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

async function probe(nome, sql, params) {
  try {
    const rows = await db.runQuery(sql, params);
    return { nome, ok: true, linhas: rows.length };
  } catch (err) {
    return { nome, ok: false, erro: String(err && err.message ? err.message : err) };
  }
}

async function rodarSondas() {
  const emitidos = loadSql("emitidos_por_vendedor.sql");
  const emitidosComFiltro = emitidos
    .split("/*__FILTRO_VENDA_REGULAR__*/")
    .join(filtroVendaRegularSql("t"));
  const emitidosSemFiltro = emitidos.split("/*__FILTRO_VENDA_REGULAR__*/").join("");
  const d = ["2026-07-01", "2026-07-02"];

  const resultados = [];
  resultados.push(await probe("sanity", "SELECT 1 AS um FROM rdb$database", []));
  resultados.push(
    await probe(
      "engine_version",
      "SELECT rdb$get_context('SYSTEM', 'ENGINE_VERSION') AS versao FROM rdb$database",
      []
    )
  );
  resultados.push(
    await probe("comentario_linha", "SELECT 1 AS um\n-- comentario\nFROM rdb$database", [])
  );
  resultados.push(
    await probe(
      "comentario_com_parenteses",
      "-- teste (5):\n--   3) empresa (int)\nSELECT 1 AS um FROM rdb$database",
      []
    )
  );
  resultados.push(
    await probe(
      "cast_param",
      "SELECT 1 AS um FROM rdb$database WHERE 1 = CAST(? AS INTEGER)",
      [1]
    )
  );
  resultados.push(
    await probe(
      "cast_param_in",
      "SELECT 1 AS um FROM rdb$database WHERE CAST(? AS INTEGER) IN (13, 18) OR 1 = 1",
      [13]
    )
  );
  resultados.push(
    await probe("emitidos_completo_com_filtro", emitidosComFiltro, [d[0], d[1], 1, 1])
  );
  resultados.push(
    await probe("emitidos_completo_sem_filtro_garantia", emitidosSemFiltro, [d[0], d[1], 1, 1])
  );
  resultados.push(
    await probe(
      "emitidos_sem_comentarios_com_filtro",
      semComentarios(emitidosComFiltro),
      [d[0], d[1], 1, 1]
    )
  );
  const engineVersion = resultados.find((r) => r.nome === "engine_version");
  if (engineVersion && engineVersion.ok) {
    try {
      const v = await db.runQuery(
        "SELECT rdb$get_context('SYSTEM', 'ENGINE_VERSION') AS versao FROM rdb$database",
        []
      );
      engineVersion.versao = v[0] && v[0].versao;
    } catch (_) {
      /* ignore */
    }
  }
  return resultados;
}

module.exports = { rodarSondas };
