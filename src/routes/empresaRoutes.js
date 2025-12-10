// src/routes/empresaRoutes.js
const express = require("express");
const router = express.Router();
const { listarEmpresas } = require("../controllers/empresaController");

router.get("/", listarEmpresas);

module.exports = router;
