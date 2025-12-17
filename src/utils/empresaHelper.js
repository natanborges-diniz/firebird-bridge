// src/utils/empresaHelper.js

const EMPRESAS_LIXO = new Set([3, 5, 7, 8, 11, 12]);
const EMPRESAS_ALL_LOGICAS = [1, 2, 4, 6, 9, 13, 14, 15, 16, 17];

function parseEmpresasParam(empresaParam) {
  if (empresaParam === undefined || empresaParam === null || empresaParam === "") {
    return [...EMPRESAS_ALL_LOGICAS];
  }

  if (typeof empresaParam === "number") {
    if (EMPRESAS_LIXO.has(empresaParam)) return [];
    return [empresaParam];
  }

  const raw = String(empresaParam).trim();

  if (!raw || raw.toUpperCase() === "ALL") {
    return [...EMPRESAS_ALL_LOGICAS];
  }

  const cods = Array.from(
    new Set(
      raw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && !EMPRESAS_LIXO.has(n))
    )
  );

  return cods;
}

module.exports = {
  EMPRESAS_LIXO,
  EMPRESAS_ALL_LOGICAS,
  parseEmpresasParam,
};
