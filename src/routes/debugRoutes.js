// src/routes/debugRoutes.js
const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');

router.get('/empresas', debugController.testarEmpresas);
router.get('/firebird-config', debugController.firebirdConfig);
router.get('/produto-tipo-map/dist', debugController.distProdutotipo);
router.get('/produto-tipo-map/locais', debugController.distEstoqueLocal);
router.get('/produto-tipo-map/classif22', debugController.distClassificacao22);
router.get('/produto-tipo-map/samples', debugController.samplesPorProdutotipo);

module.exports = router;
