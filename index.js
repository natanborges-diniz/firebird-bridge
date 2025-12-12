/**
 * ============================================================
 * Firebird Bridge - API Principal (RAIZ)
 * ============================================================
 * Responsabilidade:
 * - Subir servidor Express
 * - Configurar CORS, JSON
 * - Registrar rotas da aplicação
 * - Healthcheck
 *
 * NÃO DEVE:
 * - Executar SQL
 * - Conter lógica de negócio
 * - Conectar diretamente ao Firebird
 * ============================================================
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

/**
 * ============================================================
 * Middlewares globais
 * ============================================================
 */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

/**
 * ============================================================
 * Healthcheck
 * ============================================================
 */
app.get('/health', async (req, res) => {
  res.json({
    ok: true,
    service: 'firebird-bridge',
    status: 'UP',
    timestamp: new Date().toISOString(),
  });
});

/**
 * ============================================================
 * Importação das rotas
 * ============================================================
 */
const empresaRoutes = require('./src/routes/empresaRoutes');
const vendasRoutes = require('./src/routes/vendasRoutes');
const financeiroRoutes = require('./src/routes/financeiroRoutes');
const estoqueRoutes = require('./src/routes/estoqueRoutes');
const osRoutes = require('./src/routes/osRoutes');

/**
 * ============================================================
 * Registro das rotas
 * ============================================================
 */
app.use('/api/v1/empresas', empresaRoutes);
app.use('/api/v1/vendas', vendasRoutes);
app.use('/api/v1/financeiro', financeiroRoutes);
app.use('/api/v1/estoque', estoqueRoutes);
app.use('/api/v1/os', osRoutes);

/**
 * ============================================================
 * Rota padrão / fallback
 * ============================================================
 */
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Rota não encontrada',
    path: req.originalUrl,
  });
});

/**
 * ============================================================
 * Inicialização do servidor
 * ============================================================
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('========================================');
  console.log(' Firebird Bridge iniciado com sucesso');
  console.log(` Porta: ${PORT}`);
  console.log(` Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log('========================================');
});
