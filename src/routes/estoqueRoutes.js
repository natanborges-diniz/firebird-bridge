// src/routes/estoqueRoutes.js

const express = require('express');
const router = express.Router();
const estoqueController = require('../controllers/estoqueController');

// GET /estoque/analise-acao
router.get('/analise-acao', estoqueController.analiseEstoqueAcao);

// GET /estoque/completo
router.get('/completo', estoqueController.estoqueCompleto);

module.exports = router;
