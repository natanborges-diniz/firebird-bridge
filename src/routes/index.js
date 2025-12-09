// src/routes/index.js

const express = require('express');
const router = express.Router();

const healthController  = require('../controllers/healthController');
const financeiroRoutes  = require('./financeiroRoutes');
const vendasRoutes      = require('./vendasRoutes');

// Health check
router.get('/health', healthController.health);

// Módulo Financeiro
router.use('/financeiro', financeiroRoutes);

// Módulo Vendas
router.use('/vendas', vendasRoutes);

module.exports = router;
