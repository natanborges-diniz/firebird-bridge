// __tests__/recebimentosSqlContrato.test.js
//
// Testes de contrato dos SQLs da Fase 1 — dados de recebimento
// (estilo vendasSqlContrato.test.js; docs/REVISAO_VENDAS_METAS.md §5.1).
// Garantem as regras de negocio de metas/comissoes:
//   * valor recebido = VALORPAGO, nunca o previsto flp.VALOR (D9);
//   * periodo por DATAPAGAMENTO (regime de caixa) no detalhe;
//   * origem VENDA_PERIODO x SALDO_ANTERIOR;
//   * forma_categoria normalizada num unico CASE (D10);
//   * garantia nao e venda (placeholder de filtro de venda regular);
//   * emitidos usa TOTAL - VALORDESCONTO - TOTALIPI e DATAEMISSAO.
const fs = require('fs');
const path = require('path');

const QUERIES_DIR = path.join(__dirname, '..', 'queries', 'vendas');

function loadSql(nome) {
  return fs.readFileSync(path.join(QUERIES_DIR, nome), 'utf8');
}

// remove comentarios de linha para nao casar regex com texto de documentacao
function semComentarios(sql) {
  return sql
    .split('\n')
    .map((linha) => {
      const idx = linha.indexOf('--');
      return idx >= 0 ? linha.slice(0, idx) : linha;
    })
    .join('\n');
}


function placeholderEmComentario(sql) {
  return sql
    .split('\n')
    .filter((l) => l.trim().startsWith('--'))
    .some((l) => l.includes('__FILTRO_VENDA_REGULAR__'));
}

describe('queries/vendas/recebimentos_detalhe.sql', () => {
  const sqlBruto = loadSql('recebimentos_detalhe.sql');
  const sql = semComentarios(sqlBruto);

  it('usa VALORPAGO e nunca soma o previsto flp.VALOR (D9)', () => {
    expect(sql).toMatch(/flp\.valorpago/i);
    // "flp.valor" (previsto) nao pode aparecer — \b impede casar "valorpago"
    expect(sql).not.toMatch(/flp\.valor\b/i);
    // regressao conhecida: IIF misturando previsto e realizado
    expect(sql).not.toMatch(/IIF\s*\(\s*flp\.datapagamento\s+IS\s+NULL/i);
  });

  it('filtra o periodo por DATAPAGAMENTO com parametros direto no WHERE (regime de caixa)', () => {
    expect(sql).toMatch(/flp\.datapagamento\s+BETWEEN\s+CAST\(\?\s+AS\s+DATE\)\s+AND\s+CAST\(\?\s+AS\s+DATE\)/i);
    // saldo em aberto nao entra
    expect(sql).toMatch(/flp\.valorpago\s*>\s*0/i);
    // anti-timeout: sem o padrao JOIN P ON 1=1
    expect(sql).not.toMatch(/JOIN\s+P\s+ON\s+1\s*=\s*1/i);
  });

  it('deriva origem VENDA_PERIODO x SALDO_ANTERIOR comparando dataemissao com dataIni', () => {
    expect(sql).toMatch(/t\.dataemissao\s*>=\s*CAST\(\?\s+AS\s+DATE\)\s+THEN\s+'VENDA_PERIODO'/i);
    expect(sql).toMatch(/'SALDO_ANTERIOR'/);
  });

  it('normaliza forma_categoria num unico CASE (D10)', () => {
    expect(sql).toMatch(/CASE\s+ffp\.cod_formapagamentotipo/i);
    ['AVISTA', 'CHEQUE', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'CREDIARIO', 'CREDITOS', 'OUTROS'].forEach(
      (categoria) => expect(sql).toContain(`'${categoria}'`)
    );
    // cartao credito x debito via fincartaocreditotipo.credito
    expect(sql).toMatch(/fcct\.credito\s*=\s*'T'\s+THEN\s+'CARTAO_CREDITO'/i);
  });

  it('contem o placeholder de venda regular (garantia nao e venda)', () => {
    expect(sqlBruto).toContain('/*__FILTRO_VENDA_REGULAR__*/');
    expect(placeholderEmComentario(sqlBruto)).toBe(false);
  });

  it('restringe a vendas (naturezaoperacao.tipo = 1)', () => {
    expect(sql).toMatch(/nat\.tipo\s*=\s*1/i);
  });
});

describe('queries/vendas/emitidos_por_vendedor.sql', () => {
  const sqlBruto = loadSql('emitidos_por_vendedor.sql');
  const sql = semComentarios(sqlBruto);

  it('usa a definicao padronizada TOTAL - VALORDESCONTO - TOTALIPI (D1)', () => {
    expect(sql).toMatch(/ti\.total[\s\S]{0,120}?ti\.valordesconto[\s\S]{0,120}?ti\.totalipi/i);
  });

  it('filtra o periodo por DATAEMISSAO com parametros direto no WHERE', () => {
    expect(sql).toMatch(/t\.dataemissao\s+BETWEEN\s+CAST\(\?\s+AS\s+DATE\)\s+AND\s+CAST\(\?\s+AS\s+DATE\)/i);
    expect(sql).not.toMatch(/DATAENCERRAMENTO/i);
    expect(sql).not.toMatch(/JOIN\s+P\s+ON\s+1\s*=\s*1/i);
  });

  it('contem o placeholder de venda regular (garantia nao e venda)', () => {
    expect(sqlBruto).toContain('/*__FILTRO_VENDA_REGULAR__*/');
    expect(placeholderEmComentario(sqlBruto)).toBe(false);
  });
});

describe('queries/vendas/devolucoes_restituicao.sql', () => {
  const sqlBruto = loadSql('devolucoes_restituicao.sql');
  const sql = semComentarios(sqlBruto);

  it('esta marcada como pendente de validacao (hipotese)', () => {
    expect(sqlBruto).toMatch(/PENDENTE VALIDACAO/);
    expect(sqlBruto).toMatch(/validar:recebimentos/);
  });

  it('so considera parcelas pagas (VALORPAGO/DATAPAGAMENTO), nunca o previsto', () => {
    expect(sql).toMatch(/flp\.valorpago/i);
    expect(sql).not.toMatch(/flp\.valor\b/i);
    expect(sql).toMatch(/flp\.datapagamento\s+BETWEEN\s+CAST\(\?\s+AS\s+DATE\)/i);
  });

  it('exclui credito gerado (tipo 6) — nao abate meta/comissao', () => {
    expect(sql).toMatch(/ffp\.cod_formapagamentotipo\s*<>\s*6/i);
  });

  it('liga a devolucao via entradanotafiscaldevolucao', () => {
    expect(sql).toMatch(/entradanotafiscaldevolucao/i);
    expect(sql).toMatch(/enfd\.cod_vendedor/i);
  });
});
