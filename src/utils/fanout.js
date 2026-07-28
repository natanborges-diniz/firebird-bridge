// src/utils/fanout.js
//
// Consolida os resultados do fan-out por empresa (D13): junta as linhas das
// empresas bem-sucedidas e coleta as falhas em `empresasComErro`, para o
// controller expor no envelope de resposta (meta.empresasComErro) mantendo
// ok:true com dados parciais.
//
// Extraido do vendasService (Fase 0) para reuso pelo recebimentosService
// (Fase 1, docs/REVISAO_VENDAS_METAS.md §5.1).

/**
 * @param {string} label rotulo para log
 * @param {Array<number|string>} empresas empresas consultadas (mesma ordem)
 * @param {Array<PromiseSettledResult>} results resultados do Promise.allSettled
 * @param {(rows: Array) => Array} [mapFn] mapeamento opcional das linhas
 * @param {string} [logPrefix] prefixo do log (default: VENDAS)
 * @returns {{ rows: Array, empresasComErro: Array<{empresa: number|string, erro: string}> }}
 */
function coletarResultadosFanout(label, empresas, results, mapFn, logPrefix = "VENDAS") {
  const rows = [];
  const empresasComErro = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const value = result.value ?? [];
      rows.push(...(mapFn ? mapFn(value) : value));
      return;
    }
    const erro = result.reason?.message || String(result.reason);
    console.error(`[${logPrefix}] ${label} empresa ${empresas[index]}:`, erro);
    empresasComErro.push({ empresa: empresas[index], erro });
  });
  return { rows, empresasComErro };
}

module.exports = {
  coletarResultadosFanout,
};
