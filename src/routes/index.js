// src/routes/index.js
const express = require('express');
const vendasRoutes = require('./vendas.routes');

const router = express.Router();

router.use('/vendas', vendasRoutes);

module.exports = router;
