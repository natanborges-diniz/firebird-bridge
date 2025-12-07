// index.js (raiz)

const envModule = require('./src/config/env');
const getFirebirdConnectString =
  envModule.getFirebirdConnectString || envModule.default?.getFirebirdConnectString;
const app = require('./src/server');

const PORT = process.env.PORT || 3000;

try {
  if (typeof getFirebirdConnectString !== 'function') {
    throw new Error('getFirebirdConnectString não foi exportada de src/config/env');
  }
  // Valida e monta a string de conexão (aceita connect string direta ou host/database).
  getFirebirdConnectString();
} catch (err) {
  console.error('Falha ao validar variáveis de ambiente:', err.message);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`firebird-bridge rodando na porta ${PORT}`);
});
