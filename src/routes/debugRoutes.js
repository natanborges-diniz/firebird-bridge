// src/routes/debugRoutes.js
const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');
const inv = require('../controllers/investigaCustoController'); // TEMPORÁRIO

router.get('/empresas', debugController.testarEmpresas);
router.get('/inv-custo/schema',    inv.investigar);                  // TEMPORÁRIO
router.get('/inv-custo/campos',    inv.investigarCampos);             // TEMPORÁRIO (alias)
router.get('/inv-custo/produto',   inv.investigarProduto);            // TEMPORÁRIO
router.get('/inv-custo/itempreco', inv.investigarItemPreco);          // TEMPORÁRIO
router.get('/inv-custo/movesto',   inv.investigarMovimentoEstoque);   // TEMPORÁRIO

module.exports = router;
