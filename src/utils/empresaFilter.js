// src/utils/empresaFilter.js

/**
 * Interpreta o query param "empresa"
 * Formatos aceitos:
 *  - "206"          → single
 *  - "1,2,13"       → multi
 *  - "ALL" ou vazio → all
 */
function parseEmpresaParam(raw) {
  if (!raw || String(raw).toUpperCase() === 'ALL') {
    return { mode: 'all', empresas: null };
  }

  const parts = String(raw)
    .split(',')
    .map((p) => parseInt(p.trim(), 10))
    .filter((n) => !Number.isNaN(n));

  if (parts.length === 0) {
    return { mode: 'all', empresas: null };
  }

  if (parts.length === 1) {
    return { mode: 'single', empresas: parts };
  }

  return { mode: 'multi', empresas: parts };
}

module.exports = {
  parseEmpresaParam,
};
