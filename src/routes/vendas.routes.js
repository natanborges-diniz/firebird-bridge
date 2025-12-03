// src/routes/vendas.routes.js
const express = require('express');
const { resumoEmpresaVendedor } = require('../controllers/vendasController');

const router = express.Router();

// GET /api/v1/vendas/resumo-empresa-vendedor
router.get('/resumo-empresa-vendedor', resumoEmpresaVendedor);

module.exports = router;
