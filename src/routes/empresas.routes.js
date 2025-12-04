// src/routes/empresas.routes.js
const express = require('express');
const { listarEmpresas } = require('../controllers/empresaController');

const router = express.Router();

// GET /api/v1/empresas
router.get('/', listarEmpresas);

module.exports = router;
