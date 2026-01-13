// src/controllers/empresaController.js
const empresaService = require("../services/empresaService");
const { success, handleControllerError } = require("../utils/apiResponse");

async function listarEmpresas(req, res) {
  try {
    const useCache = req.query.cache !== '0' && req.query.cache !== 'false';
    const cacheTtlMs = req.query.cacheTtlMs ? Number(req.query.cacheTtlMs) : undefined;

    const empresas = await empresaService.getEmpresas({ useCache, cacheTtlMs });
    return success(res, empresas);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  listarEmpresas,
};
