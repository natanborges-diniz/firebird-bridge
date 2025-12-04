// src/controllers/estoqueController.js
const { getAnaliseEstoqueAcao } = require('../services/estoqueService');

/**
 * GET /api/v1/estoque/analise-acao?codEmpresa=595
 */
async function analiseEstoqueAcao(req, res) {
  try {
    const { codEmpresa } = req.query;

    if (!codEmpresa) {
      return res.status(400).json({
        error: 'Parametro obrigatorio: codEmpresa (ex: 595)'
      });
    }

    const cod = parseInt(codEmpresa, 10);
    if (Number.isNaN(cod)) {
      return res.status(400).json({
        error: 'codEmpresa deve ser um numero inteiro'
      });
    }

    const data = await getAnaliseEstoqueAcao({ codEmpresa: cod });
    res.json({ data });
  } catch (err) {
    console.error('❌ Erro analiseEstoqueAcao:', err);
    res.status(500).json({ error: 'Erro interno no bridge de estoque' });
  }
}

module.exports = {
  analiseEstoqueAcao
};
