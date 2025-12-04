// src/routes/index.js
const express = require('express');

const vendasRoutes = require('./vendas.routes');
const estoqueRoutes = require('./estoque.routes');
const osRoutes = require('./os.routes');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/api/v1/vendas', vendasRoutes);
router.use('/api/v1/estoque', estoqueRoutes);
router.use('/api/v1/os', osRoutes);

module.exports = router;
