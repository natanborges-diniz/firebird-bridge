// src/utils/empresaNormalizer.js

const EMPRESAS_LIXO = new Set([3, 5, 7, 8, 11, 12]);

function extractEmpresaCodigo(row) {
  // tenta achar algum campo de código de empresa
  const candidates = [
    row.empresa_cod_logico,
    row.cod_empresa,
    row.COD_EMPRESA,
    row.COD_EMPRESAESTOQUE,
    row.cod_empresa_estoque
  ];

  for (const c of candidates) {
    if (c !== undefined && c !== null) {
      const n = Number(c);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function extractEmpresaNome(row) {
  const candidates = [
    row.empresa_nome_logico,
    row.empresa_nome,
    row.EMPRESA,
    row.empresa,
    row.nome_empresa
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') {
      return c;
    }
  }
  return null;
}

/**
 * Normaliza empresas:
 *  - remove empresas lixo (3,5,7,8,11,12)
 *  - garante empresa_cod_logico / empresa_nome_logico
 */
function normalizeEmpresas(rows) {
  if (!Array.isArray(rows)) return rows;

  return rows
    // 1) filtra lixo
    .filter((row) => {
      const cod = extractEmpresaCodigo(row);
      if (cod == null) return true; // não tem empresa, deixa passar
      return !EMPRESAS_LIXO.has(cod);
    })
    // 2) ajusta campos lógicos
    .map((row) => {
      const cod = extractEmpresaCodigo(row);
      const nome = extractEmpresaNome(row);

      // se já vieram campos lógicos da SQL, respeita
      const alreadyHasLogical =
        row.empresa_cod_logico !== undefined ||
        row.empresa_nome_logico !== undefined;

      if (alreadyHasLogical) {
        return row;
      }

      const novo = { ...row };

      if (cod != null) {
        novo.empresa_cod_logico = cod;
        if (nome != null) {
          novo.empresa_nome_logico = nome;
        }
      }

      return novo;
    });
}

module.exports = {
  normalizeEmpresas
};
