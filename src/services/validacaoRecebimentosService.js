/**
 * Validacao dos dados de recebimento (Fase 1 — metas/comissoes) executada
 * DENTRO do bridge (que tem acesso ao Firebird via Railway), exposta por
 * GET /api/v1/vendas/recebimentos/validacao.
 *
 * Mesmas secoes do scripts/validar_recebimentos.js, retornadas como JSON:
 *  a) distribuicao de cod_formapagamentotipo (30 dias) — onde caem PIX/boleto
 *  b) amostra de parcelas pagas (semana)
 *  c) totais por forma_categoria/origem (semana)
 *  d) investigacao de devolucoes (hipotese credito x restituicao)
 *  e) recebido vs emitido (semana)
 *
 * Diagnostico read-only; amostras limitadas para resposta leve.
 */
const db = require("../db");
const recebimentosService = require("./recebimentosService");

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return isoDate(d);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function descobrirTabelaTipos() {
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
    colunas.find((c) => c === "COD_FORMAPAGAMENTOTIPO") ||
    colunas.find((c) => c.startsWith("COD_"));
  const colDesc =
    colunas.find((c) => ["DESCRICAO", "NOME", "DESCRICAOTIPO"].includes(c)) ||
    colunas.find((c) => c.includes("DESCR") || c.includes("NOME"));

  const mapa = new Map();
  if (colCod && colDesc) {
    const rows = await db.runQuery(
      `SELECT ${colCod} AS cod, ${colDesc} AS descricao FROM ${tabela}`,
      []
    );
    rows.forEach((r) => mapa.set(Number(r.cod), String(r.descricao ?? "").trim()));
  }
  return { tabela, mapa };
}

async function secaoA() {
  const { tabela, mapa } = await descobrirTabelaTipos();
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
  return {
    tabelaTipos: tabela,
    distribuicao30dias: rows.map((r) => ({
      tipo: Number(r.tipo),
      descricao: mapa.get(Number(r.tipo)) || null,
      qtd_parcelas: Number(r.qtd_parcelas),
      total_pago: round2(r.total_pago),
    })),
  };
}

function secaoC(rows) {
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
  return Array.from(mapa.values())
    .sort((a, b) => b.total_recebido - a.total_recebido)
    .map((l) => ({ ...l, total_recebido: round2(l.total_recebido) }));
}

async function secaoD() {
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
    return { aviso: `Nao foi possivel ler entradanotafiscaldevolucao: ${err.message}` };
  }
  if (!devolucoes.length) return { devolucoes: [] };

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
    const tipos = financeiro.map((f) => Number(f.tipo));
    resumo.push({
      cod_devolucao: dev.cod_devolucao,
      cod_empresa: dev.cod_empresa,
      cod_vendedor: dev.cod_vendedor,
      tipos_forma: tipos,
      gerou_credito_tipo6: tipos.includes(6),
      pago_fora_tipo6: round2(
        financeiro
          .filter((f) => Number(f.tipo) !== 6)
          .reduce((s, f) => s + Number(f.total_pago || 0), 0)
      ),
      total_previsto: round2(financeiro.reduce((s, f) => s + Number(f.total_previsto || 0), 0)),
      total_pago: round2(financeiro.reduce((s, f) => s + Number(f.total_pago || 0), 0)),
    });
  }
  return { devolucoes: resumo };
}

async function validarRecebimentos({ empresa }) {
  const dataIni = diasAtras(7);
  const dataFim = diasAtras(0);

  const ping = await db.pingDatabase();
  if (!ping.ok) {
    const err = new Error(`Firebird inacessivel: ${ping.error}`);
    err.code = "DB_UNAVAILABLE";
    throw err;
  }

  const a = await secaoA();

  const { rows, empresasComErro } = await recebimentosService.getRecebimentosDetalhe({
    empresa: String(empresa),
    dataInicio: dataIni,
    dataFim,
    useCache: false,
  });

  const c = secaoC(rows);
  const d = await secaoD();

  const totalRecebido = round2(
    rows
      .filter((r) => r.forma_categoria !== "CREDITOS")
      .reduce((s, r) => s + (Number(r.valor_recebido) || 0), 0)
  );
  const totalRecebidoComCreditos = round2(
    rows.reduce((s, r) => s + (Number(r.valor_recebido) || 0), 0)
  );
  const { rows: emitidos, empresasComErro: errosEmitidos } =
    await recebimentosService.getEmitidos({
      empresa: String(empresa),
      dataInicio: dataIni,
      dataFim,
      useCache: false,
    });

  return {
    parametros: { empresa: String(empresa), dataIni, dataFim },
    a_distribuicaoTipos: a,
    b_amostraParcelas: rows.slice(0, 20),
    b_qtdParcelasSemana: rows.length,
    b_empresasComErro: empresasComErro,
    c_totaisPorCategoriaOrigem: c,
    d_investigacaoDevolucoes: d,
    e_comparacao: {
      recebido_sem_creditos: totalRecebido,
      recebido_com_creditos: totalRecebidoComCreditos,
      emitido_em_os: round2(emitidos.reduce((s, r) => s + (Number(r.valor_emitido) || 0), 0)),
      qtd_parcelas_pagas: rows.length,
      qtd_transacoes_emitidas: emitidos.length,
      empresasComErro: errosEmitidos,
    },
  };
}

module.exports = { validarRecebimentos };
