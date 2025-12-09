// src/routes/index.js

const express = require('express');
const router = express.Router();

const healthController  = require('../controllers/healthController');
const financeiroRoutes  = require('./financeiroRoutes');
const vendasRoutes      = require('./vendasRoutes');
const debugRoutes       = require('./debugRoutes');

// Health check
router.get('/health', healthController.health);

// Módulo Financeiro
router.use('/financeiro', financeiroRoutes);

// Módulo Vendas
router.use('/vendas', vendasRoutes);

// Debug (apenas para testes)
router.use('/debug', debugRoutes);

module.exports = router;
