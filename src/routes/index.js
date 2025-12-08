const express = require('express');
const router = express.Router();
const healthRoutes = require('./healthRoutes');

router.use('/health', healthRoutes);

module.exports = router;
