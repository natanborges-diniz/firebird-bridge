// src/server.js
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

// Prefixo da API
app.use('/api/v1', apiRoutes);

module.exports = app;
