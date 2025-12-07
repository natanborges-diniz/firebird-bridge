// index.js (raiz)

const envModule = require('./src/config/env');

const resolveGetFirebirdConnectString =
  envModule?.resolveGetFirebirdConnectString ||
  ((mod) => {
    const visited = new Set();
    let current = mod;
    while (current && !visited.has(current)) {
      visited.add(current);
      if (typeof current === 'function') return current;
      if (typeof current?.getFirebirdConnectString === 'function') return current.getFirebirdConnectString;
      current = current?.default;
    }
    return null;
  });

const getFirebirdConnectString = resolveGetFirebirdConnectString(envModule);
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
