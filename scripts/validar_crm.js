/**
 * Validacao da base de clientes para entrega (CRM) contra o
 * Firebird real. Rode LOCALMENTE, onde voce tem acesso ao banco:
 *
 *   1) cp .env.example .env  e preencha os FIREBIRD_*
 *   2) node scripts/validar_crm.js [empresa]
 *
 * O script:
 *   - confirma a conexao com o banco (ping)
 *   - mostra quais colunas opcionais de PESSOA existem no schema
 *   - confirma se a tabela vendagarantia_item existe (filtro de
 *     garantia/reparo)
 *   - executa a query final e imprime contagem + amostra
 *
 * Nenhuma coluna inexistente quebra a query: o crmService poda
 * automaticamente o que nao existir.
 */
require("dotenv").config();

const db = require("../src/db");
const crmService = require("../src/services/crmService");

function parseEmpresa(arg) {
  if (arg === undefined || String(arg).toUpperCase() === "ALL") return null;
  const n = Number(arg);
  if (!Number.isFinite(n)) {
    console.error(`empresa invalida: "${arg}" (use um numero ou ALL)`);
    process.exit(1);
  }
  return n;
}

async function main() {
  const codEmpresa = parseEmpresa(process.argv[2] ?? "1");
  console.log("============================================");
  console.log(" Validacao CRM - base de clientes para entrega");
  console.log("============================================");
  console.log("empresa:", codEmpresa === null ? "ALL" : codEmpresa);

  // 1) conexao
  const ping = await db.pingDatabase();
  if (!ping.ok) {
    console.error("\n[ERRO] Nao foi possivel conectar ao Firebird:");
    console.error("       ", ping.error);
    console.error("\nConfira os FIREBIRD_* no seu .env.");
    process.exit(1);
  }
  console.log("\n[OK] Conexao com o Firebird estabelecida.");

  // 2) colunas opcionais detectadas
  const colsOpcionais = await crmService.buildColunasOpcionaisSql();
  const detectadas = colsOpcionais
    .split(/AS\s+/i)
    .slice(1)
    .map((s) => s.split(/[,\n]/)[0].trim())
    .filter(Boolean);
  console.log("\n[SCHEMA] Colunas opcionais de PESSOA presentes:");
  console.log(
    detectadas.length ? "  - " + detectadas.join("\n  - ") : "  (nenhuma)"
  );

  // 3) filtro de garantia/reparo
  const filtro = await crmService.buildFiltroOsRegularSql();
  console.log("\n[SCHEMA] Filtro garantia/reparo (vendagarantia_item):");
  console.log(filtro ? "  ATIVO (OS de garantia/reparo serao excluidas)" : "  inativo (tabela ausente)");

  // 4) executa a query
  console.log("\n[QUERY] Executando getBaseClientesEntrega...");
  const t0 = Date.now();
  const rows = await crmService.getBaseClientesEntrega({ codEmpresa });
  const ms = Date.now() - t0;
  console.log(`[OK] ${rows.length} clientes retornados em ${ms}ms.`);

  if (rows.length) {
    console.log("\n[AMOSTRA] primeiros registros:");
    console.table(rows.slice(0, 5));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n[FALHA]", err && err.message ? err.message : err);
    process.exit(1);
  });
