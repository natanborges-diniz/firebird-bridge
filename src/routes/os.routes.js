// src/routes/os.routes.js
const express = require('express');
const { monitorProducao } = require('../controllers/osController');

const router = express.Router();

// GET /api/v1/os/monitor-producao
router.get('/monitor-producao', monitorProducao);

module.exports = router;
