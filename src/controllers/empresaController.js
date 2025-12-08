// src/controllers/empresaController.js

const empresaService = require('../services/empresaService');
const { success, failure, handleControllerError } = require('../utils/apiResponse');

async function listarEmpresas(req, res) {
  try {
    const empresas = await empresaService.getEmpresas();
    return success(res, empresas);
  } catch (err) {
    return handleControllerError(res, err);
  }
}

module.exports = {
  listarEmpresas
};
