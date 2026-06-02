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
const { health } = require('./src/controllers/healthController');

const app = express();

/**
 * ============================================================
 * Middlewares globais
 * ============================================================
 */
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Health-Token'],
}));

app.use(express.json());

/**
 * ============================================================
 * Healthcheck
 * ============================================================
 */
app.get('/health', async (_req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'firebird-bridge',
    time: new Date().toISOString(),
  });
});

app.get('/api/v1/health', health);

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
const crmRoutes = require('./src/routes/crmRoutes');
const debugRoutes = require('./src/routes/debugRoutes');

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
app.use('/api/v1/crm', crmRoutes);
app.use('/api/v1/debug', debugRoutes);

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
