const express = require('express');
const router = express.Router();

const healthController = require('../controllers/healthController');
const financeiroRoutes = require('./financeiroRoutes');

router.get('/health', healthController.health);
router.use('/financeiro', financeiroRoutes);

module.exports = router;
