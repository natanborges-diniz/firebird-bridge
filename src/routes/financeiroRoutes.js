const express = require("express");
const router = express.Router();
const financeiroController = require("../controllers/financeiroController");

// GET /api/v1/financeiro/parcelas
router.get("/financeiro/parcelas", financeiroController.listarParcelas);

module.exports = router;
