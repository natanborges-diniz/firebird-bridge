// src/routes/os.routes.js
const express = require("express");
const { monitorOs } = require("../controllers/osController");

const router = express.Router();

router.get("/monitor", monitorOs);

module.exports = router;
