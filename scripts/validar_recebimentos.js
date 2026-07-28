/**
 * Validacao dos dados de recebimento (Fase 1 — metas/comissoes) contra o
 * Firebird real. Rode LOCALMENTE, onde voce tem acesso ao banco:
 *
 *   1) cp .env.example .env  e preencha os FIREBIRD_*
 *   2) npm run validar:recebimentos [empresa]     (default: 1)
 *
 * O script imprime:
 *   (a) distribuicao de cod_formapagamentotipo (com descricao, se a tabela
 *       de tipos existir — descoberta via rdb$relations) e soma de valorpago
 *       dos ultimos 30 dias — para identificar onde PIX e boleto caem
 *       (hoje mapeados como BANCO/OUTROS, PENDENTE VALIDACAO);
 *   (b) amostra de 20 parcelas pagas com todas as colunas de
 *       recebimentos_detalhe.sql;
 *   (c) totais por forma_categoria/origem de uma semana;
 *   (d) investigacao de devolucoes: para as ultimas 20
 *       entradanotafiscaldevolucao, os movimentos financeiros associados e
 *       se geraram credito (tipo 6) — valida a hipotese de
 *       devolucoes_restituicao.sql;
 *   (e) comparacao: total recebido na semana vs total emitido na semana.
 */
require("dotenv").config();

const db = require("../src/db");
const recebimentosService = require("../src/services/recebimentosService");

function parseEmpresa(arg) {
  const raw = arg ?? "1";
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.error(`empresa invalida: "${raw}" (use um numero)`);
    process.exit(1);
  }
  return n;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function fmt(n) {
  return Number(n || 0).toFixed(2);
}

async function descobrirTabelaTipos() {
  // Descobre via catalogo o nome da tabela de tipos de forma de pagamento
  // (ex.: FINFORMAPAGAMENTOTIPO) e monta o mapa codigo -> descricao.
  const relacoes = await db.runQuery(
    `SELECT TRIM(r.rdb$relation_name) AS nome
       FROM rdb$relations r
      WHERE r.rdb$system_flag = 0
        AND TRIM(r.rdb$relation_name) LIKE '%FORMAPAGAMENTOTIPO%'`,
    []
  );
  if (!relacoes.length) return { tabela: null, mapa: new Map() };

  const tabela = relacoes[0].nome;
  const colunas = (
    await db.runQuery(
      `SELECT TRIM(rf.rdb$field_name) AS nome
         FROM rdb$relation_fields rf
        WHERE TRIM(rf.rdb$relation_name) = ?`,
      [tabela]
    )
  ).map((c) => c.nome);

  const colCod =
    colunas.find((c) => c === "COD_FORMAPAGAMENTOTIPO") || colunas.find((c) => c.startsWith("COD_"));
  const colDesc =
    colunas.find((c) => ["DESCRICAO", "NOME", "DESCRICAOTIPO"].includes(c)) ||
    colunas.find((c) => c.includes("DESCR") || c.includes("NOME"));

  const mapa = new Map();
  if (colCod && colDesc) {
    const rows = await db.runQuery(`SELECT ${colCod} AS cod, ${colDesc} AS descricao FROM ${tabela}`, []);
    rows.forEach((r) => mapa.set(Number(r.cod), String(r.descricao ?? "").trim()));
  }
  return { tabela, colunas, mapa };
}

async function secaoA() {
  console.log("\n============================================================");
  console.log(" (a) Distribuicao de cod_formapagamentotipo — ultimos 30 dias");
  console.log("============================================================");

  const { tabela, mapa } = await descobrirTabelaTipos();
  console.log(
    tabela
      ? `[SCHEMA] Tabela de tipos encontrada: ${tabela} (${mapa.size} tipos)`
      : "[SCHEMA] Nenhuma tabela *FORMAPAGAMENTOTIPO* encontrada — seguindo sem descricoes"
  );

  const rows = await db.runQuery(
    `SELECT ffp.cod_formapagamentotipo AS tipo,
            COUNT(*) AS qtd_parcelas,
            SUM(COALESCE(flp.valorpago, 0)) AS total_pago
       FROM finlancamentoparcela flp
       JOIN finformapagamento ffp
         ON ffp.cod_formapagamento = flp.cod_formapagamento
      WHERE flp.datapagamento BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
        AND flp.valorpago > 0
      GROUP BY ffp.cod_formapagamentotipo
      ORDER BY 3 DESC`,
    [diasAtras(30), diasAtras(0)]
  );

  console.table(
    rows.map((r) => ({
      tipo: r.tipo,
      descricao: mapa.get(Number(r.tipo)) || "(?)",
      qtd_parcelas: r.qtd_parcelas,
      total_pago: fmt(r.total_pago),
    }))
  );
  console.log(
    "-> Onde PIX e boleto aparecem? Se cairem em tipo 4 (BANCO) ou OUTROS,\n" +
      "   ajustar o CASE de forma_categoria em recebimentos_detalhe.sql."
  );
}

async function secaoB(empresa, dataIni, dataFim) {
  console.log("\n============================================================");
  console.log(` (b) Amostra de 20 parcelas pagas (empresa ${empresa}, ${dataIni} a ${dataFim})`);
  console.log("============================================================");

  const { rows, empresasComErro } = await recebimentosService.getRecebimentosDetalhe({
    empresa: String(empresa),
    dataInicio: dataIni,
    dataFim,
    useCache: false,
  });
  if (empresasComErro.length) console.log("[AVISO] empresasComErro:", empresasComErro);
  console.log(`[OK] ${rows.length} parcelas no periodo.`);
  console.table(rows.slice(0, 20));
  return rows;
}

function secaoC(rows) {
  console.log("\n============================================================");
  console.log(" (c) Totais por forma_categoria / origem (mesma semana)");
  console.log("============================================================");

  const mapa = new Map();
  rows.forEach((r) => {
    const chave = `${r.forma_categoria}|${r.origem}`;
    const atual = mapa.get(chave) || {
      forma_categoria: r.forma_categoria,
      origem: r.origem,
      qtd_parcelas: 0,
      total_recebido: 0,
    };
    atual.qtd_parcelas += 1;
    atual.total_recebido += Number(r.valor_recebido) || 0;
    mapa.set(chave, atual);
  });
  console.table(
    Array.from(mapa.values())
      .sort((a, b) => b.total_recebido - a.total_recebido)
      .map((l) => ({ ...l, total_recebido: fmt(l.total_recebido) }))
  );
}

async function secaoD() {
  console.log("\n============================================================");
  console.log(" (d) Investigacao de devolucoes (hipotese credito x restituicao)");
  console.log("============================================================");

  let devolucoes;
  try {
    devolucoes = await db.runQuery(
      `SELECT FIRST 20
              enfd.cod_entradanotafiscaldevolucao AS cod_devolucao,
              enfd.cod_empresa,
              enfd.cod_vendedor
         FROM entradanotafiscaldevolucao enfd
        ORDER BY enfd.cod_entradanotafiscaldevolucao DESC`,
      []
    );
  } catch (err) {
    console.log("[AVISO] Nao foi possivel ler entradanotafiscaldevolucao:", err.message);
    return;
  }
  if (!devolucoes.length) {
    console.log("(nenhuma devolucao encontrada)");
    return;
  }

  const resumo = [];
  for (const dev of devolucoes) {
    let financeiro = [];
    try {
      financeiro = await db.runQuery(
        `SELECT ffp.cod_formapagamentotipo AS tipo,
                COUNT(*) AS qtd_parcelas,
                COUNT(flp.datapagamento) AS qtd_pagas,
                SUM(COALESCE(flp.valor, 0)) AS total_previsto,
                SUM(COALESCE(flp.valorpago, 0)) AS total_pago
           FROM transacao td
           JOIN finfaturatransacao fft
             ON fft.cod_faturatransacao = td.cod_faturatransacao
           JOIN finlancamento fl
             ON fl.cod_faturatransacao = fft.cod_faturatransacao
           JOIN finlancamentoparcela flp
             ON flp.cod_lancamento = fl.cod_lancamento
           JOIN finformapagamento ffp
             ON ffp.cod_formapagamento = flp.cod_formapagamento
          WHERE td.cod_transacao = ?
            AND td.cod_empresa = ?
          GROUP BY ffp.cod_formapagamentotipo`,
        [dev.cod_devolucao, dev.cod_empresa]
      );
    } catch (err) {
      resumo.push({ cod_devolucao: dev.cod_devolucao, erro: err.message });
      continue;
    }

    const tipos = financeiro.map((f) => f.tipo);
    resumo.push({
      cod_devolucao: dev.cod_devolucao,
      cod_empresa: dev.cod_empresa,
      cod_vendedor: dev.cod_vendedor,
      tipos_forma: tipos.join(",") || "(sem financeiro)",
      gerou_credito_tipo6: tipos.includes(6) ? "SIM" : "nao",
      pago_fora_tipo6: fmt(
        financeiro.filter((f) => f.tipo !== 6).reduce((s, f) => s + Number(f.total_pago || 0), 0)
      ),
      total_previsto: fmt(financeiro.reduce((s, f) => s + Number(f.total_previsto || 0), 0)),
      total_pago: fmt(financeiro.reduce((s, f) => s + Number(f.total_pago || 0), 0)),
    });
  }
  console.table(resumo);
  console.log(
    "-> Hipotese de devolucoes_restituicao.sql: restituicao = parcela PAGA em\n" +
      "   forma <> tipo 6; credito gerado = movimento tipo 6. Se as devolucoes\n" +
      "   nao tiverem financeiro proprio, a hipotese precisa ser revista."
  );
}

async function secaoE(empresa, dataIni, dataFim, rowsRecebidos) {
  console.log("\n============================================================");
  console.log(" (e) Comparacao: recebido vs emitido na semana");
  console.log("============================================================");

  const totalRecebido = rowsRecebidos
    .filter((r) => r.forma_categoria !== "CREDITOS")
    .reduce((s, r) => s + (Number(r.valor_recebido) || 0), 0);
  const totalRecebidoComCreditos = rowsRecebidos.reduce(
    (s, r) => s + (Number(r.valor_recebido) || 0),
    0
  );

  const { rows: emitidos, empresasComErro } = await recebimentosService.getEmitidos({
    empresa: String(empresa),
    dataInicio: dataIni,
    dataFim,
    useCache: false,
  });
  if (empresasComErro.length) console.log("[AVISO] empresasComErro (emitidos):", empresasComErro);
  const totalEmitido = emitidos.reduce((s, r) => s + (Number(r.valor_emitido) || 0), 0);

  console.table([
    { metrica: "recebido (sem CREDITOS)", valor: fmt(totalRecebido) },
    { metrica: "recebido (com CREDITOS)", valor: fmt(totalRecebidoComCreditos) },
    { metrica: "emitido em OS", valor: fmt(totalEmitido) },
    { metrica: "qtd parcelas pagas", valor: rowsRecebidos.length },
    { metrica: "qtd transacoes emitidas", valor: emitidos.length },
  ]);
  console.log(
    "-> Diferencas sao esperadas (regime de caixa x emissao); confira contra a\n" +
      "   auditoria manual do ERP para 2 lojas de amostra (criterio da Fase 1)."
  );
}

async function main() {
  const empresa = parseEmpresa(process.argv[2]);
  const dataIni = diasAtras(7);
  const dataFim = diasAtras(0);

  console.log("============================================");
  console.log(" Validacao Fase 1 - dados de recebimento");
  console.log("============================================");
  console.log("empresa:", empresa, "| semana:", dataIni, "a", dataFim);

  const ping = await db.pingDatabase();
  if (!ping.ok) {
    console.error("\n[ERRO] Nao foi possivel conectar ao Firebird:");
    console.error("       ", ping.error);
    console.error("\nConfira os FIREBIRD_* no seu .env.");
    process.exit(1);
  }
  console.log("\n[OK] Conexao com o Firebird estabelecida.");

  await secaoA();
  const rowsSemana = await secaoB(empresa, dataIni, dataFim);
  secaoC(rowsSemana);
  await secaoD();
  await secaoE(empresa, dataIni, dataFim, rowsSemana);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n[FALHA]", err && err.message ? err.message : err);
    process.exit(1);
  });
