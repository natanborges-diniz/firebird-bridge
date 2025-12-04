// src/routes/os.routes.js
const express = require('express');
const { monitorOS } = require('../controllers/osController');

const router = express.Router();

// GET /api/v1/os/monitor
router.get('/monitor', monitorOS);

module.exports = router;
