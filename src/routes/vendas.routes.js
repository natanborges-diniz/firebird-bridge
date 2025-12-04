// src/routes/vendas.routes.js
const express = require('express');
const {
  resumoEmpresaVendedor,
  resumoFormasPagamento
} = require('../controllers/vendasController');

const router = express.Router();

// Já existia:
router.get('/resumo-empresa-vendedor', resumoEmpresaVendedor);

// NOVO ENDPOINT:
router.get('/resumo-formas-pagamento', resumoFormasPagamento);

module.exports = router;
