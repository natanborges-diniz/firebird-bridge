// src/routes/financeiro.routes.js
const express = require("express");
const router = express.Router();
const financeiroController = require("../controllers/financeiroController");

// GET /api/v1/financeiro/parcelas
router.get("/parcelas", financeiroController.listarParcelas);

// DEBUG: GET /api/v1/financeiro/debug/resumo-empresas
router.get("/debug/resumo-empresas", financeiroController.resumoPorEmpresa);

module.exports = router;
