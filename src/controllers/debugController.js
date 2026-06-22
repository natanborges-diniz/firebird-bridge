// src/controllers/debugController.js
const { success, handleControllerError } = require('../utils/apiResponse');
const { pingDatabase } = require('../db');

async function testarEmpresas(req, res) {
  // Array "sujo": empresa normal, lixo e as duas SUPER
  const linhas = [
    { COD_EMPRESA: 1, EMPRESA: 'DINIZ PRIMITIVA I' },
    { COD_EMPRESA: 3, EMPRESA: 'EMPRESA LIXO 3' },
    { COD_EMPRESA: 13, EMPRESA: 'DINIZ SUPER (CNPJ antigo)' },
    { COD_EMPRESA: 18, EMPRESA: 'DINIZ SUPER SHOPPING (CNPJ novo)' },
    { cod_empresa: 5, empresa: 'EMPRESA LIXO 5' }
  ];

  return success(res, linhas);
}

function maskSecret(value) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value);
  if (s.length <= 2) return '*'.repeat(s.length);
  if (s.length <= 4) return s[0] + '*'.repeat(s.length - 1);
  return `${s.slice(0, 2)}${'*'.repeat(s.length - 4)}${s.slice(-2)}`;
}

function maskHost(value) {
  if (!value) return null;
  const s = String(value);
  // mostra primeiro octeto / primeiro label, mascara o resto
  const dot = s.indexOf('.');
  if (dot < 0) return s.length <= 3 ? s : `${s.slice(0, 2)}***`;
  return `${s.slice(0, dot)}.***`;
}

async function firebirdConfig(req, res) {
  try {
    const cfg = {
      host_raw_length: process.env.FIREBIRD_HOST ? String(process.env.FIREBIRD_HOST).length : 0,
      host_masked: maskHost(process.env.FIREBIRD_HOST),
      port: Number(process.env.FIREBIRD_PORT || 3050),
      database: process.env.FIREBIRD_DATABASE || null,
      user: process.env.FIREBIRD_USER || 'SYSDBA (default)',
      user_is_default: !process.env.FIREBIRD_USER,
      password_masked: maskSecret(process.env.FIREBIRD_PASSWORD || 'masterkey'),
      password_is_default: !process.env.FIREBIRD_PASSWORD,
      password_length: (process.env.FIREBIRD_PASSWORD || 'masterkey').length,
      charset: process.env.FIREBIRD_CHARSET || 'WIN1252',
      node_env: process.env.NODE_ENV || null,
    };

    const ping = await pingDatabase();
    const pingResult = {
      ok: ping.ok === true,
      error: ping.ok ? null : ping.error || null,
    };

    return success(res, { config: cfg, ping: pingResult });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  testarEmpresas,
  firebirdConfig,
};
