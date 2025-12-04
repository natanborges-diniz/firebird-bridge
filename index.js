// index.js - entrypoint principal do firebird-bridge

const express = require('express');
const cors = require('cors');
const routes = require('./src/routes'); // carrega src/routes/index.js

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares básicos
app.use(cors());
app.use(express.json());

// Todas as rotas da API ficam centralizadas em src/routes/index.js
app.use(routes);

// Health check raiz (opcional)
app.get('/', (req, res) => {
  res.json({ status: 'firebird-bridge ok', version: '1.0.0' });
});

// Sobe o servidor
app.listen(PORT, () => {
  console.log(`🚀 Firebird-bridge rodando na porta ${PORT}`);
});

module.exports = app;
