// src/routes/crmRoutes.js
const express = require("express");
const router = express.Router();

const crmController = require("../controllers/crmController");

// GET /api/v1/crm/base?empresa=1
router.get("/base", crmController.baseClientesEntrega);

module.exports = router;
