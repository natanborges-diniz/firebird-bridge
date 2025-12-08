// src/routes/index.js

const express = require('express');
const router = express.Router();

/**
 * Carrega rota sem derrubar servidor caso arquivo não exista.
 */
function safeMount(path, file) {
  try {
    const module = require(file);
    router.use(path, module);
    console.log(`[ROUTES] Mounted ${path} -> ${file}`);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.warn(`[ROUTES] Route file not found: ${file}`);
    } else {
      console.error(`[ROUTES] Error loading ${file}:`, err);
    }
  }
}

// ROTAS DISPONÍVEIS
safeMount('/health', './healthRoutes');
safeMount('/financeiro', './financeiroRoutes');
safeMount('/vendas', './vendasRoutes');
safeMount('/estoque', './estoqueRoutes');
safeMount('/os', './osRoutes');
safeMount('/empresas', './empresaRoutes');

module.exports = router;
