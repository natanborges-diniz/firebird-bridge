// src/routes/vendasRoutes.js
const express = require('express');
const router = express.Router();

const vendasController = require('../controllers/vendasController');
const recebimentosController = require('../controllers/recebimentosController');

// GET /api/v1/vendas/resumo-empresa-vendedor
router.get('/resumo-empresa-vendedor', vendasController.resumoEmpresaVendedor);

// GET /api/v1/vendas/resumo-formas-pagamento
router.get('/resumo-formas-pagamento', vendasController.resumoFormasPagamento);

// GET /api/v1/vendas/auditoria-formas-pagamento
router.get('/auditoria-formas-pagamento', vendasController.auditoriaFormasPagamento);

// GET /api/v1/vendas/auditoria-formas-pagamento-light
router.get('/auditoria-formas-pagamento-light', vendasController.auditoriaFormasPagamentoLight);

// GET /api/v1/vendas/analise-familia-vendedor
router.get('/analise-familia-vendedor', vendasController.analiseFamiliaVendedor);

// GET /api/v1/vendas/analise-sku
router.get('/analise-sku', vendasController.analiseSku);

// GET /api/v1/vendas/resumo-diario-simples
router.get('/resumo-diario-simples', vendasController.resumoDiarioSimples);

router.get('/resumo-empresa-vendedor/debug', vendasController.debugResumoEmpresaVendedor);

// Fase 1 — Dados de recebimento (metas/comissoes sobre valores RECEBIDOS)
// Estas rotas ficam sob /api/v1/vendas, ja registrado nos DOIS entrypoints
// (index.js e src/routes/index.js).

// GET /api/v1/vendas/recebimentos — parcelas pagas no periodo (detalhe)
router.get('/recebimentos', recebimentosController.recebimentosDetalhe);

// GET /api/v1/vendas/recebimentos/agregado — shape do sync diario
router.get('/recebimentos/agregado', recebimentosController.recebimentosAgregado);

// GET /api/v1/vendas/recebimentos/validacao — diagnostico read-only da Fase 1
// (executado no Railway, unico ambiente com acesso ao Firebird)
router.get('/recebimentos/validacao', recebimentosController.validacao);

// GET /api/v1/vendas/emitidos — modo alternativo "emitido em OS"
router.get('/emitidos', recebimentosController.emitidos);

// GET /api/v1/vendas/devolucoes-restituicao — PENDENTE VALIDACAO (hipotese)
router.get('/devolucoes-restituicao', recebimentosController.devolucoesRestituicao);

module.exports = router;
