// index.js (raiz)

const { assertEnv } = require('./src/config/env');
const app = require('./src/server');

const PORT = process.env.PORT || 3000;

try {
  assertEnv();
} catch (err) {
  console.error('Falha ao validar variáveis de ambiente:', err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`firebird-bridge rodando na porta ${PORT}`);
});
