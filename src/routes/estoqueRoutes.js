// src/routes/estoqueRoutes.js

const express = require('express');
const router = express.Router();
const estoqueController = require('../controllers/estoqueController');
const vendasController = require('../controllers/vendasController');

// GET /estoque/analise-acao
router.get('/analise-acao', estoqueController.analiseEstoqueAcao);

// GET /estoque/completo
router.get('/completo', estoqueController.estoqueCompleto);

// GET /estoque/analise-sku
// Alias de estoque para o mesmo contrato de /vendas/analise-sku.
router.get('/analise-sku', vendasController.analiseSku);

module.exports = router;
