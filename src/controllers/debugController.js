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
    const [campos, sample] = await Promise.all([
      db.query(
        `SELECT TRIM(RDB$FIELD_NAME) AS campo
         FROM RDB$RELATION_FIELDS
         WHERE RDB$RELATION_NAME = 'PRODUTO'
         ORDER BY RDB$FIELD_POSITION`,
        []
      ),
      db.query(
        `SELECT FIRST 15
           p.COD_PRODUTO,
           TRIM(p.DESCRICAO) AS descricao,
           p.CODIGOBARRA,
           p.COD_PRODUTO AS cod_sku_ref
         FROM PRODUTO p
         WHERE p.COD_PRODUTO IN (3137229, 3136961, 3284399, 215535, 3293456, 3269587, 3308678, 2837226, 215888, 3134167)
         OR p.COD_PRODUTO < 300000`,
        []
      ),
    ]);

    return success(res, { campos: campos.map(r => r.campo || Object.values(r)[0]), sample });
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  testarEmpresas,
  investigarProduto,
};
