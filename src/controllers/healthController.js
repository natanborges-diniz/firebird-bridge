// src/controllers/healthController.js
const { pingDatabase } = require('../db');

/**
 * GET /health
 * Opcionalmente verifica a conexão com o Firebird.
 */
async function healthCheck(req, res) {
  try {
    const shouldCheckDb = req.query.checkDb === 'true';

    if (shouldCheckDb) {
      await pingDatabase();
    }

    return res.json({
      ok: true,
      checkDb: shouldCheckDb ? 'passed' : 'skipped',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Erro no healthCheck:', err);
    return res.status(503).json({
      ok: false,
      error: 'Banco indisponível no momento'
    });
  }
}

module.exports = {
  healthCheck
};
