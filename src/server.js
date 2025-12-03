// src/server.js
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

// Health check simples
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Rotas da API v1
app.use('/api/v1', apiRoutes);

module.exports = app;
