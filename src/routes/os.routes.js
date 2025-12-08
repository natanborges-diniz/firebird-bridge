// src/routes/osRoutes.js
const express = require('express');
const router = express.Router();
const osController = require('../controllers/osController');

router.get('/monitor', osController.monitor);

module.exports = router;
