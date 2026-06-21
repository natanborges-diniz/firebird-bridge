// src/routes/syncRoutes.js

const express = require('express');
const router = express.Router();
const { dispararSync, statusSync } = require('../controllers/syncEstoqueController');

router.post('/estoque', dispararSync);
router.get('/estoque/status', statusSync);

module.exports = router;
