const financeiroRoutes = require('./routes/financeiroRoutes');
const vendasRoutes = require('./routes/vendasRoutes');
const estoqueRoutes = require('./routes/estoqueRoutes');
const osRoutes = require('./routes/osRoutes');
const healthRoutes = require('./routes/healthRoutes');
const empresaRoutes = require('./routes/empresaRoutes');
const errorHandler = require('./middleware/errorHandler');

app.use('/api/v1/financeiro', financeiroRoutes);
app.use('/api/v1/vendas', vendasRoutes);
app.use('/api/v1/estoque', estoqueRoutes);
app.use('/api/v1/os', osRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/empresas', empresaRoutes);
app.use(errorHandler);

module.exports = router;
