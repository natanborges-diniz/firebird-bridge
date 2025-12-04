// src/routes/index.js
const express = require('express');

const vendasRoutes = require('./vendas.routes');
const estoqueRoutes = require('./estoque.routes');

const router = express.Router();

// Health check simples (se ainda nao existir, opcional)
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Vendas
router.use('/api/v1/vendas', vendasRoutes);

// Estoque
router.use('/api/v1/estoque', estoqueRoutes);

module.exports = router;
