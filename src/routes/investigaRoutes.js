// src/routes/investigaRoutes.js
// TEMPORÁRIO — investigação Passo A. REMOVER após coleta.

const express = require('express');
const router = express.Router();
const c = require('../controllers/investigaController');

router.get('/colunas-estoquelog', c.colunasEstoquelog);
router.get('/cobertura', c.cobertura);
router.get('/amostra-emp18', c.amostraEmp18);
router.get('/tipos-nao', c.tiposNao);

module.exports = router;
