// src/routes/index.js
const express = require('express');

const vendasRoutes = require('./vendas.routes');
const estoqueRoutes = require('./estoque.routes');
const osRoutes = require('./os.routes');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Vendas
router.use('/api/v1/vendas', vendasRoutes);

// Estoque
router.use('/api/v1/estoque', estoqueRoutes);

// Ordens de Serviço (Monitor de Produção)
router.use('/api/v1/os', osRoutes);

module.exports = router;
