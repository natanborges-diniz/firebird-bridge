// src/utils/vendaRegular.js
//
// Garantia NAO e venda (mesma regra do CRM/crmService): OS de garantia/reparo
// possuem linha em vendagarantia_item, ligada a venda via
// ordemservicocaixa.cod_transacao -> vendagarantia_item.cod_ordemservicocaixa.
// As queries de vendas/recebimentos trazem o placeholder
// /*__FILTRO_VENDA_REGULAR__*/ que e trocado em runtime por um NOT EXISTS
// (ou removido, com fallback gracioso, caso a tabela nao exista no schema —
// checagem via rdb$relation_fields).
//
// Extraido do vendasService (Fase 0) para reuso pelo recebimentosService
// (Fase 1, docs/REVISAO_VENDAS_METAS.md §5.1).
const { hasColumn } = require("./schemaIntrospection");

const FILTRO_VENDA_REGULAR_PLACEHOLDER = "/*__FILTRO_VENDA_REGULAR__*/";
const VENDA_GARANTIA_TABLE = "VENDAGARANTIA_ITEM";
const VENDA_GARANTIA_OS_COLUMN = "COD_ORDEMSERVICOCAIXA";

function filtroVendaRegularSql(aliasTransacao) {
  return (
    "AND NOT EXISTS (\n" +
    "      SELECT 1\n" +
    "        FROM vendagarantia_item vgi\n" +
    "        JOIN ordemservicocaixa ocx_g\n" +
    "          ON ocx_g.cod_ordemservicocaixa = vgi.cod_ordemservicocaixa\n" +
    `       WHERE ocx_g.cod_transacao = ${aliasTransacao}.cod_transacao\n` +
    "    )"
  );
}

/**
 * Substitui todas as ocorrencias do placeholder de venda regular pelo
 * NOT EXISTS contra vendagarantia_item (ou por string vazia se a tabela
 * nao existir no schema).
 * @param {string} sql
 * @param {string} aliasTransacao alias da tabela TRANSACAO na query
 */
async function aplicarFiltroVendaRegular(sql, aliasTransacao) {
  const temVendaGarantia = await hasColumn(VENDA_GARANTIA_TABLE, VENDA_GARANTIA_OS_COLUMN);
  const filtro = temVendaGarantia ? filtroVendaRegularSql(aliasTransacao) : "";
  return sql.split(FILTRO_VENDA_REGULAR_PLACEHOLDER).join(filtro);
}

module.exports = {
  FILTRO_VENDA_REGULAR_PLACEHOLDER,
  filtroVendaRegularSql,
  aplicarFiltroVendaRegular,
};
