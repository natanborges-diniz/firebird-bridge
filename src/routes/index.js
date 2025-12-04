// src/routes/index.js
const express = require('express');

const vendasRoutes = require('./vendas.routes');
const estoqueRoutes = require('./estoque.routes');
const osRoutes = require('./os.routes');
const empresasRoutes = require('./empresas.routes');
const financeiroRoutes = require('./financeiro.routes'); // 👈 ADICIONAR

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Empresas
router.use('/api/v1/empresas', empresasRoutes);

// Vendas
router.use('/api/v1/vendas', vendasRoutes);

// Estoque
router.use('/api/v1/estoque', estoqueRoutes);

// Ordens de Serviço
router.use('/api/v1/os', osRoutes);

// Financeiro
router.use('/api/v1/financeiro', financeiroRoutes); // 👈 ADICIONAR

module.exports = router;
