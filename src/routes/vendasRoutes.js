// src/routes/vendasRoutes.js

const express = require('express');
const router = express.Router();
const vendasController = require('../controllers/vendasController');

// GET /vendas/resumo-empresa-vendedor
router.get('/resumo-empresa-vendedor', vendasController.resumoEmpresaVendedor);

// GET /vendas/resumo-formas-pagamento
router.get('/resumo-formas-pagamento', vendasController.resumoFormasPagamento);

// GET /vendas/analise-familia-vendedor
router.get('/analise-familia-vendedor', vendasController.analiseFamiliaVendedor);

module.exports = router;
