// src/routes/vendasRoutes.js
const express = require('express');
const router = express.Router();

const vendasController = require('../controllers/vendasController');

// GET /api/v1/vendas/resumo-empresa-vendedor
router.get('/resumo-empresa-vendedor', vendasController.resumoEmpresaVendedor);

// GET /api/v1/vendas/resumo-formas-pagamento
router.get('/resumo-formas-pagamento', vendasController.resumoFormasPagamento);

// GET /api/v1/vendas/analise-familia-vendedor
router.get('/analise-familia-vendedor', vendasController.analiseFamiliaVendedor);

module.exports = router;
