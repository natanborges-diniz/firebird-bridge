// src/routes/vendas.routes.js
const express = require('express');
const {
  resumoEmpresaVendedor,
  resumoFormasPagamento
} = require('../controllers/vendasController');
const {
  analiseFamiliaVendedor
} = require('../controllers/vendasAnaliseController');

const router = express.Router();

// Já existiam:
router.get('/resumo-empresa-vendedor', resumoEmpresaVendedor);
router.get('/resumo-formas-pagamento', resumoFormasPagamento);

// NOVO: análise por família e vendedor
router.get('/analise-familia-vendedor', analiseFamiliaVendedor);

module.exports = router;
