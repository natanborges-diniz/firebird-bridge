// src/routes/vendasRoutes.js
const express = require('express');
const router = express.Router();
const vendasController = require('../controllers/vendasController');

router.get('/resumo-empresa-vendedor', vendasController.resumoEmpresaVendedor);
router.get('/resumo-formas-pagamento', vendasController.resumoFormasPagamento);
router.get('/analise-familia-vendedor', vendasController.analiseFamiliaVendedor);

module.exports = router;
