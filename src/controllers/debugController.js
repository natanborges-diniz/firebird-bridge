// src/controllers/debugController.js
const { success, handleControllerError } = require('../utils/apiResponse');
const { pingDatabase } = require('../db');
const debugProdutoTipoService = require('../services/debugProdutoTipoService');

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

function makeHandler(fn) {
  return async function handler(_req, res) {
    try {
      const data = await fn();
      return success(res, data);
    } catch (err) {
      return handleControllerError(res, err);
    }
  };
}

const distProdutotipo    = makeHandler(debugProdutoTipoService.distProdutotipo);
const distEstoqueLocal   = makeHandler(debugProdutoTipoService.distEstoqueLocal);
const distClassificacao22 = makeHandler(debugProdutoTipoService.distClassificacao22);
const samplesPorProdutotipo = makeHandler(debugProdutoTipoService.samplesPorProdutotipo);

module.exports = {
  testarEmpresas,
  firebirdConfig,
  distProdutotipo,
  distEstoqueLocal,
  distClassificacao22,
  samplesPorProdutotipo,
  schema, // hoisted — declarada abaixo
};

// ─── Descoberta de schema (F0 do modo fiscal — SPEC_P3 no repo insights) ───
// GET /debug/schema?like=PEDIDO  → tabelas de usuário cujo nome casa o padrão
// GET /debug/schema?table=X      → colunas da tabela X
async function schema(req, res) {
  try {
    const db = require('../db');
    const table = (req.query.table || '').trim().toUpperCase();
    const like = (req.query.like || '').trim().toUpperCase();

    if (table) {
      if (!/^[A-Z0-9_$]{1,60}$/.test(table)) return success(res, { erro: 'nome de tabela inválido' });
      const cols = await db.query(
        `SELECT TRIM(rf.rdb$field_name) AS coluna,
                TRIM(t.rdb$type_name)   AS tipo,
                f.rdb$field_length      AS tamanho
         FROM rdb$relation_fields rf
         JOIN rdb$fields f ON f.rdb$field_name = rf.rdb$field_source
         LEFT JOIN rdb$types t ON t.rdb$type = f.rdb$field_type AND t.rdb$field_name = 'RDB$FIELD_TYPE'
         WHERE rf.rdb$relation_name = ?
         ORDER BY rf.rdb$field_position`,
        [table]
      );
      return success(res, { tabela: table, colunas: cols });
    }

    if (!like || !/^[A-Z0-9_$%]{2,60}$/.test(like)) {
      return success(res, { erro: 'informe ?like=PADRAO (ex.: PEDIDO) ou ?table=NOME' });
    }
    const tabelas = await db.query(
      `SELECT TRIM(r.rdb$relation_name) AS tabela
       FROM rdb$relations r
       WHERE r.rdb$system_flag = 0
         AND r.rdb$view_blr IS NULL
         AND r.rdb$relation_name LIKE ?
       ORDER BY 1`,
      [`%${like}%`]
    );
    return success(res, { padrao: like, tabelas });
  } catch (err) {
    return handleControllerError(res, err);
  }
}
