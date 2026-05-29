// src/routes/crmRoutes.js
const express = require("express");
const router = express.Router();

const crmController = require("../controllers/crmController");

// GET /api/v1/crm/base?empresa=1
router.get("/base", crmController.baseClientesEntrega);

// GET /api/v1/crm/entregas?empresa=1&dataIni=YYYY-MM-DD&dataFim=YYYY-MM-DD
router.get("/entregas", crmController.entregasPorData);

// GET /api/v1/crm/aniversariantes?empresa=1[&data=YYYY-MM-DD]
router.get("/aniversariantes", crmController.aniversariantes);

module.exports = router;
