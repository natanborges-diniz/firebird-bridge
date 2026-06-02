// src/controllers/debugController.js
const { success, handleControllerError } = require('../utils/apiResponse');
const db = require('../db');

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

async function investigarProduto(req, res) {
  try {
    const campos = await db.query(
      `SELECT RDB$FIELD_NAME AS campo FROM RDB$RELATION_FIELDS WHERE RDB$RELATION_NAME = 'PRODUTO' ORDER BY RDB$FIELD_POSITION`,
      []
    );
    const sample = await db.query(
      `SELECT FIRST 10 p.COD_PRODUTO, p.CODIGOBARRA FROM PRODUTO p`,
      []
    );
    return success(res, { campos, sample });
  } catch (err) {
    return res.status(500).json({ ok: false, erro: err.message, stack: err.stack });
  }
}

module.exports = {
  testarEmpresas,
  investigarProduto,
};
