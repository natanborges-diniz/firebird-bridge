// src/routes/debugRoutes.js
const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');

router.get('/empresas', debugController.testarEmpresas);
router.get('/firebird-config', debugController.firebirdConfig);
router.get('/produto-tipo-map', debugController.mapearProdutoTipo);

module.exports = router;
