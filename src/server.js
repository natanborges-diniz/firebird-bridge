// src/server.js
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

// Rotas da API (já prefixadas em src/routes)
app.use(apiRoutes);

module.exports = app;
