// src/services/catalogoService.js
//
// Cadastro de produtos (catálogo) — SEM junção com estoque.
// Finalidade: alimentar a sincronização de catálogo externo (Atlas) com
// codigo_barras (PRODUTO.CODIGOBARRA) como chave estável por SKU.
//
// O cadastro tem ~1M de linhas — o endpoint é paginado (limit/offset) e o
// filtro de tipo é aplicado no SQL como SUPERSET barato (COD_PRODUTOTIPO
// indexável: 7 = lentes de grau, 13 = armações), com refinamento exato do
// rótulo `tipo` em JS. Por padrão retorna só itens ativos (ITEM.ATIVO = 'T').

const path = require("path");
const fs = require("fs");
const db = require("../db"); // expõe db.query

function loadSql(fileName) {
  const filePath = path.join(__dirname, "..", "..", "queries", "catalogo", fileName);
  return fs.readFileSync(filePath, "utf8");
}

const sqlItensCadastro = loadSql("itens_cadastro.sql");

const LIMIT_PADRAO = 5000;
const LIMIT_MAXIMO = 50000;

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

// Condições SQL por tipo — SUPERSET barato do rótulo exato (o refinamento
// final é feito em JS sobre o campo `tipo` calculado). COD_PRODUTOTIPO cobre
// o grosso sem LIKE; as heurísticas de descrição complementam o legado.
const LIKE_GC = `' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% GC %'`;
const LIKE_LC = `' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% LC %'`;
const LIKE_LG = `' ' || UPPER(TRIM(item.descricao)) || ' ' LIKE '% LG %'`;
const CONDICAO_SQL_POR_TIPO = {
  LENTES_GRAU: `(produto.cod_produtotipo = 7 OR ${LIKE_LG})`,
  LENTES_CONTATO: `(${LIKE_GC} OR ${LIKE_LC})`,
  ARMACOES: `(produto.cod_produtotipo = 13 OR UPPER(TRIM(item.descricao)) STARTING WITH 'OC' OR UPPER(TRIM(item.descricao)) STARTING WITH 'AR')`,
  ACESSORIOS: `(UPPER(TRIM(item.descricao)) STARTING WITH 'AC')`,
  OUTROS: null, // sem condição barata — cai no scan (JS refina)
};

// Candidatas de coluna de ativação do item (ITEM.ATIVO confirmada no schema
// atual via /debug/schema; mantém a checagem para resistir a variações).
const ATIVO_CANDIDATAS = [
  ["ITEM", "ATIVO", "item.ativo"],
  ["PRODUTO", "ATIVO", "produto.ativo"],
];

let ativoColunaCache; // undefined = não checado; string = expressão; null = não existe

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

async function resolveAtivoColuna() {
  if (ativoColunaCache !== undefined) return ativoColunaCache;

  for (const [tabela, coluna, expressao] of ATIVO_CANDIDATAS) {
    // eslint-disable-next-line no-await-in-loop
    if (await hasColumn(tabela, coluna)) {
      ativoColunaCache = expressao;
      return ativoColunaCache;
    }
  }

  ativoColunaCache = null;
  return ativoColunaCache;
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
 * Normaliza o parâmetro ?desde= (sync incremental).
 * Aceita YYYY-MM-DD ou YYYY-MM-DDTHH:MM(:SS). Retorna string validada para
 * uso literal no SQL (regex estrita — sem risco de injeção) ou null.
 * Lança erro com .code = "INVALID_DESDE" para formato desconhecido.
 */
function parseDesdeParam(desde) {
  if (desde === undefined || desde === null || String(desde).trim() === "") return null;

  const valor = String(desde).trim();
  const m = valor.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2})?))?$/);
  if (!m) {
    const err = new Error(`desde inválido: ${valor} (formato: YYYY-MM-DD ou YYYY-MM-DDTHH:MM:SS)`);
    err.code = "INVALID_DESDE";
    throw err;
  }
  return m[2] ? `${m[1]} ${m[2]}` : `${m[1]} 00:00:00`;
}

function parseInteiro(valor, nome, { min, max, padrao }) {
  if (valor === undefined || valor === null || String(valor).trim() === "") {
    return padrao;
  }
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) {
    const err = new Error(`${nome} inválido: ${valor} (aceito: ${min}–${max})`);
    err.code = "INVALID_LIMIT";
    throw err;
  }
  return n;
}

const ERRO_CHARSET = /transliterate|malformed string|arithmetic exception/i;

// COD_PRODUTO é VARCHAR(20): o keyset é LEXICOGRÁFICO (comparação de
// string usa o índice da PK; comparação numérica coage por linha e ignora
// o índice — full scan). A ordenação do endpoint sempre foi a de string,
// então cursor = último cod retornado, comparado como texto.
function parseAposCod(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === "") return null;
  const s = String(valor).trim();
  if (!/^[A-Za-z0-9._-]{1,20}$/.test(s)) {
    const err = new Error(`aposCod inválido: ${s}`);
    err.code = "INVALID_LIMIT";
    throw err;
  }
  return s;
}

/**
 * Executa a consulta para o intervalo ROWS [ini, fim] (1-based, inclusivo).
 * Em erro de charset, bisseciona o intervalo e pula as linhas corrompidas
 * (intervalo de 1 linha que falha), logando o offset para diagnóstico.
 */
async function consultarComSalvamento(sqlSemRows, ini, fim, profundidade = 0) {
  const sql = sqlSemRows.split("/*__ROWS__*/").join(`ROWS ${ini} TO ${fim}`);
  try {
    return await db.query(sql, []);
  } catch (err) {
    const msg = String(err && err.message ? err.message : err);
    if (!ERRO_CHARSET.test(msg)) throw err;
    if (ini >= fim) {
      console.warn(`[CATALOGO] linha corrompida PULADA (posição ROWS ${ini}): ${msg.slice(0, 80)}`);
      return [];
    }
    if (profundidade > 16) {
      console.error(`[CATALOGO] bisseccao excedeu profundidade em ROWS ${ini}-${fim}`);
      return [];
    }
    const meio = Math.floor((ini + fim) / 2);
    const [a, b] = await Promise.all([
      consultarComSalvamento(sqlSemRows, ini, meio, profundidade + 1),
      consultarComSalvamento(sqlSemRows, meio + 1, fim, profundidade + 1),
    ]);
    return [...a, ...b];
  }
}

/**
 * Cadastro de produtos, uma linha por cod_sku. SEMPRE paginado.
 * @param {object} opts
 * @param {string} [opts.tipo] filtro CSV: ARMACOES, LENTES_GRAU,
 *   LENTES_CONTATO, ACESSORIOS, OUTROS, alias LENTES; ALL/vazio = todos.
 * @param {string|number} [opts.limit] tamanho da página (padrão 5000, máx 50000)
 * @param {string|number} [opts.offset] deslocamento (padrão 0)
 * @param {string} [opts.incluirInativos] "1"/"true" para incluir inativos
 *   (padrão: só ITEM.ATIVO = 'T'; com ?desde= o padrão vira INCLUIR, para o
 *   delta capturar desativações — passe incluirInativos=0 para sobrescrever)
 * @param {string} [opts.desde] sync incremental: só linhas com
 *   DATAALTERACAO/DATAINCLUSAO >= desde (YYYY-MM-DD ou com hora). Sem o
 *   parâmetro, retorna a carga completa (usar só no setup inicial).
 * @param {string|number} [opts.aposCod] paginação por KEYSET: retorna itens
 *   com cod_produto > aposCod (usa o índice da PK — custo constante em
 *   qualquer profundidade, ao contrário de offset/ROWS que re-varre tudo).
 *   Preferir SEMPRE em cargas completas; offset fica para compatibilidade.
 */
async function getItensCadastro({ tipo, limit, offset, incluirInativos, desde, aposCod, codigoBarras: codigoBarrasRaw } = {}) {
  const tiposFiltro = parseTipoParam(tipo);
  const desdeTs = parseDesdeParam(desde);
  // lookup pontual por código de barras (diagnóstico/consulta)
  const codigoBarras = codigoBarrasRaw && /^[A-Za-z0-9.-]{1,20}$/.test(String(codigoBarrasRaw).trim())
    ? String(codigoBarrasRaw).trim()
    : null;
  const tamPagina = parseInteiro(limit, "limit", { min: 1, max: LIMIT_MAXIMO, padrao: LIMIT_PADRAO });
  const desloc = parseInteiro(offset, "offset", { min: 0, max: 100000000, padrao: 0 });
  const cursorCod = parseAposCod(aposCod);
  const flagInativos = String(incluirInativos ?? "").trim().toLowerCase();
  // Delta (?desde=) precisa enxergar desativações; carga completa não.
  const comInativos = flagInativos === ""
    ? Boolean(desdeTs)
    : ["1", "true", "t", "sim"].includes(flagInativos);

  const ativoColuna = await resolveAtivoColuna();

  // split/join = substitui TODAS as ocorrências (replace() só pega a 1ª)
  let sql = sqlItensCadastro
    .split("/*__ATIVO_SELECT__*/")
    .join(ativoColuna ? `,\n  ${ativoColuna} AS ativo` : "");

  const condicoes = [];
  // No modo delta (?desde=) o filtro de tipo fica FORA do SQL de propósito:
  // os LIKEs sobre descrição avaliariam texto de TODAS as ~1M linhas do scan,
  // e linhas legadas com bytes corrompidos derrubam a query ("Cannot
  // transliterate"). Com WHERE só de datas (colunas date/int, imunes a
  // charset), as expressões de texto rodam apenas nas linhas retornadas —
  // e o refinamento de tipo acontece no JS, sobre o delta pequeno.
  if (tiposFiltro && !desdeTs) {
    const partes = [...tiposFiltro].map((t) => CONDICAO_SQL_POR_TIPO[t]);
    // Se algum tipo pedido não tem condição barata (OUTROS), não dá para
    // podar no SQL sem perder linhas — o refinamento fica só no JS.
    if (!partes.some((p) => p == null)) {
      condicoes.push(`(${partes.join(" OR ")})`);
    }
  }
  if (!comInativos && ativoColuna) {
    condicoes.push(`${ativoColuna} = 'T'`);
  }
  if (desdeTs) {
    // ITEM.DATAALTERACAO cobre edições (inclusive ATIVO e preço);
    // ITEM.DATAINCLUSAO cobre itens novos; PRODUTO.DATAALTERACAO cobre
    // mudanças do lado produto (código de barras, custo, tipo).
    condicoes.push(
      `(item.dataalteracao >= CAST('${desdeTs}' AS TIMESTAMP)
    OR item.datainclusao >= CAST('${desdeTs}' AS TIMESTAMP)
    OR produto.dataalteracao >= CAST('${desdeTs}' AS TIMESTAMP))`
    );
  }
  // Paginação com SALVAMENTO POR BISSECÇÃO: linhas legadas com bytes
  // corrompidos derrubam a query inteira ("Cannot transliterate…",
  // "Malformed string", "Arithmetic exception…"). Quando um intervalo
  // falha, dividimos ao meio recursivamente até isolar a(s) linha(s)
  // podre(s), que são PULADAS e logadas — o resto da página é entregue.
  if (cursorCod !== null) {
    // string entre aspas: comparação lexicográfica indexada
    condicoes.push(`produto.cod_produto > '${cursorCod}'`);
  }
  if (codigoBarras) {
    condicoes.push(`TRIM(produto.codigobarra) = '${codigoBarras}'`);
  }
  sql = sql
    .split("/*__WHERE__*/")
    .join(condicoes.length ? `WHERE ${condicoes.join("\n  AND ")}` : "");

  // Keyset: a janela sempre começa em ROWS 1 (o corte é o cursor no WHERE)
  const rows = cursorCod !== null
    ? await consultarComSalvamento(sql, 1, tamPagina)
    : await consultarComSalvamento(sql, desloc + 1, desloc + tamPagina);

  // Normalização defensiva: CHARs do Firebird chegam com padding de espaços
  for (const row of rows) {
    if (typeof row.tipo === "string") row.tipo = row.tipo.trim();
    if (typeof row.subcategoria === "string") row.subcategoria = row.subcategoria.trim();
    if (typeof row.ativo === "string") row.ativo = row.ativo.trim();
  }

  // Refinamento exato: o WHERE do SQL é um superset barato do rótulo `tipo`
  if (!tiposFiltro) return rows;
  return rows.filter((row) => tiposFiltro.has(String(row.tipo || "").trim().toUpperCase()));
}

module.exports = {
  getItensCadastro,
  parseTipoParam, // exportado para testes
  parseDesdeParam, // exportado para testes
};
