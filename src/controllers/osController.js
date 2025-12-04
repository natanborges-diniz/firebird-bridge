// src/controllers/osController.js

const { runQuery } = require("../db");

/**
 * Monitor de OS - versão otimizada
 * - 1 linha por OS
 * - Traz etapa atual (codEtapaAtual)
 * - Traz última entrada/saída (dataHoraUltimaEntrada / dataHoraUltimaSaida)
 * - Permite filtro por data de emissão e opcional por empresa
 */
async function monitorOs(req, res) {
  const { dataInicio, dataFim, codEmpresa } = req.query;

  if (!dataInicio || !dataFim) {
    return res
      .status(400)
      .json({ error: "Parâmetros dataInicio e dataFim são obrigatórios" });
  }

  // IMPORTANTE:
  // Usamos subselects para pegar a ÚLTIMA etapa da OS (ordemservicocaixalog)
  // Isso evita ter várias linhas por OS.
  let sql = `
    SELECT FIRST 1000
      emp.nome AS EMPRESA,
      osc.numeroordemservico AS OS,
      osc.total AS TOTAL,
      osc.dataemissao AS DATAEMISSAO,
      osc.dataprevisao AS DATAPREVISAO,
      cli.nome AS CLIENTE,
      cli.cod_pessoa AS CODCLIENTE,
      cli.cpf AS CPF,
      osc.cod_empresaorigem AS CODEMPRESA,

      -- Etapa atual (código)
      (
        SELECT FIRST 1 l.cod_etapa
        FROM ordemservicocaixalog l
        WHERE l.cod_ordemservicocaixa = osc.cod_ordemservicocaixa
        ORDER BY l.datahoraentrada DESC
      ) AS CODETAPA_ATUAL,

      -- Última entrada na etapa
      (
        SELECT FIRST 1 l.datahoraentrada
        FROM ordemservicocaixalog l
        WHERE l.cod_ordemservicocaixa = osc.cod_ordemservicocaixa
        ORDER BY l.datahoraentrada DESC
      ) AS DATAHORAENTRADA_ULTIMA,

      -- Última saída da etapa
      (
        SELECT FIRST 1 l.datahorasaida
        FROM ordemservicocaixalog l
        WHERE l.cod_ordemservicocaixa = osc.cod_ordemservicocaixa
        ORDER BY l.datahoraentrada DESC
      ) AS DATAHORASAIDA_ULTIMA

    FROM
      ordemservicocaixa osc
      JOIN pessoa emp
        ON emp.cod_pessoa = osc.cod_empresaorigem
      JOIN pessoa cli
        ON cli.cod_pessoa = osc.cod_cliente
    WHERE
      osc.dataemissao BETWEEN ? AND ?
  `;

  const params = [dataInicio, dataFim];

  if (codEmpresa) {
    sql += " AND osc.cod_empresaorigem = ?";
    params.push(Number(codEmpresa));
  }

  sql += " ORDER BY osc.dataemissao DESC";

  console.log("[OS MONITOR] SQL:", sql);
  console.log("[OS MONITOR] Params:", params);

  try {
    const rows = await runQuery(sql, params);
    return res.json(rows);
  } catch (err) {
    console.error("❌ Erro monitorOs:", err);
    return res.status(500).json({ error: "Erro ao buscar monitor de OS" });
  }
}

module.exports = {
  monitorOs,
};
