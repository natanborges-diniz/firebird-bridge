// src/routes/empresaRoutes.js

const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');

router.get('/', empresaController.listarEmpresas);

module.exports = router;
