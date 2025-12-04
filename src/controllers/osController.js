const { runQuery } = require('../db');

async function monitorOS(req, res) {
  try {
    const { dataInicio, dataFim, codEmpresa, etapa, q } = req.query;

    if (!dataInicio || !dataFim) {
      return res.status(400).json({ error: 'dataInicio e dataFim são obrigatórios' });
    }

    // Versão enxuta baseada na sua consulta de OS,
    // dá pra ir enriquecendo depois com mais joins.
    let sql = `
      SELECT
        ordemservicocaixa.cod_ordemservicocaixa AS ID_OS,
        ordemservicocaixa.numeroordemservico     AS NUMERO_OS,
        ordemservicocaixa.dataemissao            AS DATA_EMISSAO,
        ordemservicocaixa.dataprevisao           AS DATA_PREVISAO,
        pessoaempresa.nome                       AS EMPRESA,
        pessoacliente.nome                       AS CLIENTE,
        pessoacliente.cpf                        AS CPF,
        pessoacliente.telefonecelular            AS TELEFONE,
        usuario.username                         AS USUARIO,
        ordemservicocaixalog.cod_etapa           AS COD_ETAPA,
        ordemservicocaixalog.datahoraentrada     AS DATAHORA_ENTRADA,
        ordemservicocaixalog.datahorasaida       AS DATAHORA_SAIDA
      FROM
        ordemservicocaixa
        JOIN pessoa pessoaempresa
          ON pessoaempresa.cod_pessoa = ordemservicocaixa.cod_empresaorigem
        JOIN pessoa pessoacliente
          ON pessoacliente.cod_pessoa = ordemservicocaixa.cod_cliente
        JOIN ordemservicocaixalog
          ON ordemservicocaixalog.cod_ordemservicocaixa = ordemservicocaixa.cod_ordemservicocaixa
        JOIN usuario
          ON usuario.cod_usuario = ordemservicocaixalog.cod_usuario
      WHERE
        ordemservicocaixa.dataemissao BETWEEN ? AND ?
    `;

    const params = [dataInicio, dataFim];

    if (codEmpresa) {
      sql += ' AND ordemservicocaixa.cod_empresaorigem = ?';
      params.push(codEmpresa);
    }

    if (etapa) {
      sql += ' AND ordemservicocaixalog.cod_etapa = ?';
      params.push(etapa);
    }

    if (q) {
      sql += `
        AND (
          pessoacliente.nome LIKE ?
          OR pessoacliente.telefonecelular LIKE ?
          OR ordemservicocaixa.numeroordemservico LIKE ?
        )
      `;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    sql += `
      ORDER BY
        ordemservicocaixa.dataemissao DESC,
        ordemservicocaixa.numeroordemservico DESC
    `;

    const rows = await runQuery(sql, params);

    res.json({ data: rows });
  } catch (err) {
    console.error('Erro no monitor de OS:', err);
    res.status(500).json({ error: 'Erro ao buscar monitor de OS' });
  }
}

module.exports = {
  monitorOS
};
