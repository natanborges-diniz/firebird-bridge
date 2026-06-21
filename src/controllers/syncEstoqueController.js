// src/controllers/syncEstoqueController.js

const { randomUUID } = require('crypto');
const syncEstoqueService = require('../services/syncEstoqueService');

// Estado em memória do último run (simples, sem persistência entre reinícios)
let ultimoRun = null;
let runEmAndamento = false;

/**
 * POST /api/v1/sync/estoque[?empresa=N]
 * Dispara o sync em background e retorna 202 imediatamente.
 */
async function dispararSync(req, res) {
  if (runEmAndamento) {
    return res.status(409).json({
      ok: false,
      error: 'Sync já em andamento. Consulte GET /api/v1/sync/estoque/status',
    });
  }

  const empresaParam = req.query.empresa;
  const empresa = empresaParam != null ? Number(empresaParam) : null;

  if (empresaParam != null && !Number.isFinite(empresa)) {
    return res.status(400).json({
      ok: false,
      error: 'Parâmetro empresa inválido. Deve ser numérico ou omitido.',
    });
  }

  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  res.status(202).json({
    ok:          true,
    mode:        'background',
    run_id:      runId,
    started_at:  startedAt,
    empresas:    empresa != null ? [empresa] : 'TODAS',
    message:     'Sync iniciado. Consulte GET /api/v1/sync/estoque/status para acompanhar.',
  });

  runEmAndamento = true;
  syncEstoqueService.syncTodasEmpresas(empresa)
    .then(resultado => {
      ultimoRun = { run_id: runId, ...resultado };
    })
    .catch(err => {
      ultimoRun = {
        run_id:      runId,
        ok:          false,
        error:       err.message,
        started_at:  startedAt,
        finished_at: new Date().toISOString(),
      };
    })
    .finally(() => {
      runEmAndamento = false;
    });
}

/**
 * GET /api/v1/sync/estoque/status
 * Retorna estado do último run e se há sync em andamento.
 */
function statusSync(req, res) {
  res.json({
    ok:           true,
    em_andamento: runEmAndamento,
    ultimo_run:   ultimoRun,
  });
}

module.exports = { dispararSync, statusSync };
