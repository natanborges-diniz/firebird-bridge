// src/routes/index.js

const express = require('express');
const router = express.Router();

// Endpoint mínimo só pra garantir que a API sobe
router.get('/health', (req, res) => {
  return res.json({
    ok: true,
    data: { status: 'UP', db: 'SKIPPED' },
    error: null
  });
});

module.exports = router;
