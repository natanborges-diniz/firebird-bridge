// index.js (raiz)

const express = require('express');
const cors = require('cors');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health simples – NÃO toca no Firebird
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Rotas principais da API (vendas, estoque, OS etc.)
app.use(routes);

app.listen(PORT, () => {
  console.log(`firebird-bridge rodando na porta ${PORT}`);
});
