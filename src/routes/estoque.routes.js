// src/routes/estoqueRoutes.js
const express = require('express');
const router = express.Router();
const estoqueController = require('../controllers/estoqueController');

router.get('/analise', estoqueController.analiseEstoque);

module.exports = router;
