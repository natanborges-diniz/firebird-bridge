// src/routes/estoque.routes.js
const express = require('express');
const { analiseEstoqueAcao } = require('../controllers/estoqueController');

const router = express.Router();

// GET /api/v1/estoque/analise-acao?codEmpresa=595
router.get('/analise-acao', analiseEstoqueAcao);

module.exports = router;
