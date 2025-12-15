const express = require('express');
const router = express.Router();
const osController = require('../controllers/osController');

router.get('/monitor', osController.monitorOs);
router.get('/monitor-ultima-etapa', osController.monitorOsUltimaEtapa);

module.exports = router;
