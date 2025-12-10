// src/routes/osRoutes.js

const express = require('express');
const router = express.Router();
const osController = require('../controllers/osController');

// GET /os/monitor
router.get('/monitor', osController.monitorOs);

module.exports = router;
