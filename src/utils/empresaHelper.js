// src/utils/empresaHelper.js

// Empresas que nunca entram (lixo)
const EMPRESAS_LIXO = new Set([3, 5, 7, 8, 11, 12]);

// Lista padrão para empresa=ALL (SEM lixo, com SUPER unificada na lógica)
const EMPRESAS_ALL_LOGICAS = [1, 2, 4, 6, 9, 13, 14, 15, 16, 17];

/**
 * Converte o parâmetro empresa da API para um array de códigos numéricos.
 *
 * Regras:
 *  - vazio ou "ALL"  -> EMPRESAS_ALL_LOGICAS
 *  - "1"             -> [1]
 *  - "1,9,13"        -> [1, 9, 13]
 *  - lixo (3,5,7,8,11,12) é automaticamente removido
 */
function parseEmpresasParam(empresaParam) {
  const raw = (empresaParam || '').trim();

  if (!raw || raw.toUpperCase() === 'ALL') {
    return [...EMPRESAS_ALL_LOGICAS];
  }

  const cods = Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n) && !EMPRESAS_LIXO.has(n))
    )
  );

  return cods;
}

module.exports = {
  EMPRESAS_LIXO,
  EMPRESAS_ALL_LOGICAS,
  parseEmpresasParam,
};
