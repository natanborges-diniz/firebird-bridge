const express = require('express');

const vendasRoutes = require('./vendas.routes');
const estoqueRoutes = require('./estoque.routes');
const empresasRoutes = require('./empresas.routes');

const router = express.Router();

// Health check simples
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Vendas
router.use('/api/v1/vendas', vendasRoutes);

// Estoque
router.use('/api/v1/estoque', estoqueRoutes);

// Empresas
router.use('/api/v1/empresas', empresasRoutes);

module.exports = router;
