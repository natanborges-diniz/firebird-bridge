// src/services/osService.js
const { runQuery } = require('../db');
const { loadSQL } = require('../utils/loadSQL');

const monitorProducaoSql = loadSQL('os/monitor_producao.sql');

async function getMonitorProducao({ dataInicio, dataFim, codEmpresa }) {
  const params = [
    dataInicio,  // 1º ? -> data inicial
    dataFim      // 2º ? -> data final
  ];

  const rows = await runQuery(monitorProducaoSql, params);

  // Se foi passado codEmpresa, filtra em memória pelo CODEMPRESA
  if (codEmpresa) {
    const cod = Number(codEmpresa);
    return rows.filter((r) => Number(r.CODEMPRESA) === cod);
  }

  return rows;
}

module.exports = {
  getMonitorProducao
};
