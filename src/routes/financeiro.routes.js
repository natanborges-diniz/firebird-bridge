// src/routes/financeiroRoutes.js
const express = require('express');
const router = express.Router();
const financeiroController = require('../controllers/financeiroController');

router.get('/parcelas', financeiroController.listarParcelas);
router.get('/dre', financeiroController.obterDRE);

module.exports = router;
