// src/routes/index.js
const express = require('express');

const vendasRoutes = require('./vendas.routes');
const estoqueRoutes = require('./estoque.routes');
const osRoutes = require('./os.routes');
const empresasRoutes = require('./empresas.routes');
const financeiroRoutes = require('./financeiro.routes');
const { healthCheck } = require('../controllers/healthController');

const router = express.Router();

// Health check (opcionalmente testa o Firebird com ?checkDb=true)
router.get('/health', healthCheck);

// Empresas (usado nos filtros dos painéis)
router.use('/api/v1/empresas', empresasRoutes);

// Financeiro (parcelas, DRE, etc.)
router.use('/api/v1/financeiro', financeiroRoutes); // 👈 IMPORTANTE

// Vendas
router.use('/api/v1/vendas', vendasRoutes);

// Estoque
router.use('/api/v1/estoque', estoqueRoutes);

// Ordens de Serviço (Monitor de Produção)
router.use('/api/v1/os', osRoutes);

module.exports = router;
