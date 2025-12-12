// src/routes/vendasRoutes.js
const express = require('express');
const router = express.Router();

const vendasController = require('../controllers/vendasController');

// Prefixo já é aplicado em src/routes/index.js (ex: /api/v1/vendas)
router.get('/resumo-empresa-vendedor', vendasController.resumoEmpresaVendedor);
router.get('/resumo-formas-pagamento', vendasController.resumoFormasPagamento);

// se você tiver esse endpoint implementado no controller:
if (typeof vendasController.analiseFamiliaVendedor === 'function') {
  router.get('/analise-familia-vendedor', vendasController.analiseFamiliaVendedor);
}

module.exports = router;
