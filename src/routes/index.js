const financeiroRoutes = require('./financeiroRoutes');
const vendasRoutes = require('./vendasRoutes');
const estoqueRoutes = require('./estoqueRoutes');
const osRoutes = require('./osRoutes');
const healthRoutes = require('./healthRoutes');
const empresaRoutes = require('./empresaRoutes');
const errorHandler = require('./middleware/errorHandler');

app.use('/api/v1/financeiro', financeiroRoutes);
app.use('/api/v1/vendas', vendasRoutes);
app.use('/api/v1/estoque', estoqueRoutes);
app.use('/api/v1/os', osRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/api/v1/empresas', empresaRoutes);
app.use(errorHandler);

module.exports = router;
