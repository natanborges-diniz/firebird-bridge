// src/routes/vendasRoutes.js
const express = require('express');
const router = express.Router();

const vendasController = require('../controllers/vendasController');

// GET /api/v1/vendas/resumo-empresa-vendedor
router.get('/resumo-empresa-vendedor', vendasController.resumoEmpresaVendedor);

// GET /api/v1/vendas/resumo-formas-pagamento
router.get('/resumo-formas-pagamento', vendasController.resumoFormasPagamento);

// GET /api/v1/vendas/auditoria-formas-pagamento
router.get('/auditoria-formas-pagamento', vendasController.auditoriaFormasPagamento);

// GET /api/v1/vendas/auditoria-formas-pagamento-light
router.get('/auditoria-formas-pagamento-light', vendasController.auditoriaFormasPagamentoLight);

// GET /api/v1/vendas/analise-familia-vendedor
router.get('/analise-familia-vendedor', vendasController.analiseFamiliaVendedor);

// GET /api/v1/vendas/analise-sku
router.get('/analise-sku', vendasController.analiseSku);

// GET /api/v1/vendas/resumo-diario-simples
router.get('/resumo-diario-simples', vendasController.resumoDiarioSimples);

router.get('/resumo-empresa-vendedor/debug', vendasController.debugResumoEmpresaVendedor);

module.exports = router;
