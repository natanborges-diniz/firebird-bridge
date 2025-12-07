// index.js (raiz)

const envModule = require('./src/config/env');
const getFirebirdConnectString = (() => {
  if (typeof envModule === 'function') return envModule;
  if (typeof envModule?.getFirebirdConnectString === 'function') return envModule.getFirebirdConnectString;
  if (typeof envModule?.default === 'function') return envModule.default;
  if (typeof envModule?.default?.getFirebirdConnectString === 'function') {
    return envModule.default.getFirebirdConnectString;
  }
  return null;
})();
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
