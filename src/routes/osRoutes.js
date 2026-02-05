const express = require('express');
const router = express.Router();
const osController = require('../controllers/osController');

router.get('/monitor', osController.monitorOs);
router.get('/monitor-ultima-etapa', osController.monitorOsUltimaEtapa);
router.get('/receitas-metadata', osController.receitaMetadata);
router.get('/receita-metadata', osController.receitaMetadata);
router.get('/receitas/metadata', osController.receitaMetadata);

module.exports = router;
