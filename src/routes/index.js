// src/routes/index.js

const express = require('express');
const router = express.Router();

const healthController  = require('../controllers/healthController');
const financeiroRoutes  = require('./financeiroRoutes');
const vendasRoutes      = require('./vendasRoutes');
const debugRoutes       = require('./debugRoutes');
const estoqueRoutes     = require('./estoqueRoutes'); // ⬅ novo
const osRoutes          = require('./osRoutes');
const empresaRoutes     = require('./empresaRoutes');
const crmRoutes         = require('./crmRoutes');
const syncRoutes        = require('./syncRoutes');

// Health check
router.get('/health', healthController.health);

// Módulo Financeiro
router.use('/financeiro', financeiroRoutes);

// Módulo Vendas
router.use('/vendas', vendasRoutes);

// Debug (apenas para testes)
router.use('/debug', debugRoutes);

// Módulo Estoque
router.use('/estoque', estoqueRoutes);

// Módulo OS
router.use('/os', osRoutes);

// Moculo Empresa
router.use('/empresas', empresaRoutes);

// Módulo CRM
router.use('/crm', crmRoutes);

// Módulo Sync
router.use('/sync', syncRoutes);

module.exports = router;
