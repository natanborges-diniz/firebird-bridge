// src/routes/catalogoRoutes.js

const express = require('express');
const router = express.Router();
const catalogoController = require('../controllers/catalogoController');

// GET /catalogo/itens — cadastro de produtos (sem estoque), ?tipo= opcional
router.get('/itens', catalogoController.itensCadastro);

module.exports = router;
