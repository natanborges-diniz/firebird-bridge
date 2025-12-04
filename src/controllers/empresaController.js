// src/controllers/empresaController.js
const { getEmpresas } = require('../services/empresaService');

/**
 * GET /api/v1/empresas
 */
async function listarEmpresas(req, res) {
  try {
    const data = await getEmpresas();
    res.json({ data });
  } catch (err) {
    console.error('❌ Erro listarEmpresas:', err);
    res.status(500).json({ error: 'Erro ao listar empresas' });
  }
}

module.exports = {
  listarEmpresas
};
