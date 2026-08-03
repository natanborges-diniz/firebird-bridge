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

  it('regra de regime: cartoes no PROCESSAMENTO (emissao, valor integral) e demais no PAGAMENTO', () => {
    // bloco A: cartoes (tipo 3) por dataemissao, valor integral (pago ou futuro)
    expect(sql).toMatch(/ffp\.cod_formapagamentotipo\s*=\s*3/i);
    expect(sql).toMatch(/t\.dataemissao\s+BETWEEN\s+CAST\(\?\s+AS\s+DATE\)\s+AND\s+CAST\(\?\s+AS\s+DATE\)/i);
    expect(sql).toMatch(/COALESCE\(NULLIF\(flp\.valorpago,\s*0\),\s*flp\.valor\)/i);
    // bandeira interna SALDO A RECEBER fora do bloco de cartoes
    expect(sql).toMatch(/<>\s*'SALDO A RECEBER'/i);
    // bloco B: demais formas pelo pagamento efetivo do cliente
    // (COALESCE(datapagamento, datarecebimento)); quitacoes de saldo em
    // cartao usam a data da QUITACAO via CASE — o filtro fica no CASE...END
    expect(sql).toMatch(/COALESCE\(flp\.datapagamento,\s*flp\.datarecebimento\)/i);
    expect(sql).toMatch(/END\s+BETWEEN\s+CAST\(\?\s+AS\s+DATE\)\s+AND\s+CAST\(\?\s+AS\s+DATE\)/i);
    expect(sql).toMatch(/COALESCE\(NULLIF\(flp\.valorpago,\s*0\),\s*flp\.valor\)\s*>\s*0/i);
    // cartoes de verdade nao entram no bloco B
    expect(sql).toMatch(/cod_formapagamentotipo\s*<>\s*3/i);
    // regressao conhecida: IIF misturando previsto e realizado
    expect(sql).not.toMatch(/IIF\s*\(\s*flp\.datapagamento\s+IS\s+NULL/i);
    // anti-timeout: sem o padrao JOIN P ON 1=1
    expect(sql).not.toMatch(/JOIN\s+P\s+ON\s+1\s*=\s*1/i);
  });

  it('traz as OS que compoem a venda (os_list via ordemservicocaixa)', () => {
    expect(sql).toMatch(/LIST\(/i);
    expect(sql).toMatch(/ocx\.cod_transacao\s*=\s*t\.cod_transacao/i);
    expect(sql).toMatch(/AS os_list/i);
  });

  it('expoe cod_fatura nos dois blocos (dedup de fatura compartilhada no service)', () => {
    // venda com N transacoes na mesma fatura duplicava a base (aferido 2026-08);
    // a subquery canonica em SQL estoura timeout, entao o service deduplica
    const matches = sql.match(/t\.cod_faturatransacao\s+AS\s+cod_fatura/gi) || [];
    expect(matches.length).toBe(2); // blocos A e B
  });

  it('deriva origem VENDA_PERIODO x SALDO_ANTERIOR comparando dataemissao com dataIni', () => {
    expect(sql).toMatch(/t\.dataemissao\s*>=\s*CAST\(\?\s+AS\s+DATE\)\s+THEN\s+'VENDA_PERIODO'/i);
    expect(sql).toMatch(/'SALDO_ANTERIOR'/);
  });

  it('normaliza forma_categoria (cartoes no bloco A; demais no bloco B) (D10)', () => {
    ['AVISTA', 'CHEQUE', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PIX', 'CREDIARIO', 'CREDITOS', 'OUTROS'].forEach(
      (categoria) => expect(sql).toContain(`'${categoria}'`)
    );
    // cartao credito x debito via fincartaocreditotipo.credito
    expect(sql).toMatch(/fcct\.credito\s*=\s*'T'\s+THEN\s+'CARTAO_CREDITO'/i);
    // tipo 4 (boleto) e tipo 5 (carne) = CREDIARIO
    expect(sql).toMatch(/cod_formapagamentotipo\s*=\s*4\s+THEN\s+'CREDIARIO'/i);
    expect(sql).toMatch(/cod_formapagamentotipo\s*=\s*5\s+THEN\s+'CREDIARIO'/i);
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

describe('recebimentosService.dedupeFaturaCompartilhada', () => {
  const { dedupeFaturaCompartilhada } = require('../src/services/recebimentosService');

  it('fatura compartilhada por 2 transacoes: parcela conta 1x, os_list une as OS', () => {
    const rows = [
      // venda 86409: transacoes 503468/503469 na MESMA fatura 900 — parcela duplicada
      { cod_empresa: 1, cod_transacao: 503468, cod_fatura: 900, numero_venda: 86409, os_list: '111', valor_recebido: 4709 },
      { cod_empresa: 1, cod_transacao: 503469, cod_fatura: 900, numero_venda: 86409, os_list: '222', valor_recebido: 4709 },
      // venda normal: fatura propria — intocada
      { cod_empresa: 1, cod_transacao: 600000, cod_fatura: 901, numero_venda: 87000, os_list: '333', valor_recebido: 100 },
      // linha sem cod_fatura (defensivo) — intocada
      { cod_empresa: 1, cod_transacao: 600001, cod_fatura: null, numero_venda: 87001, os_list: 'SEM_OS', valor_recebido: 50 },
    ];
    const out = dedupeFaturaCompartilhada(rows);
    expect(out).toHaveLength(3);
    const canonica = out.find((r) => r.numero_venda === 86409);
    expect(canonica.cod_transacao).toBe(503468);
    expect(canonica.os_list.split(',').sort()).toEqual(['111', '222']);
    expect(out.find((r) => r.numero_venda === 87000).os_list).toBe('333');
    const soma = out.reduce((s, r) => s + r.valor_recebido, 0);
    expect(soma).toBe(4709 + 100 + 50); // sem duplicacao
  });

  it('varias parcelas da mesma fatura compartilhada: todas mantidas 1x na canonica', () => {
    const rows = [
      { cod_empresa: 1, cod_transacao: 10, cod_fatura: 77, os_list: 'A', valor_recebido: 30 },
      { cod_empresa: 1, cod_transacao: 11, cod_fatura: 77, os_list: 'B', valor_recebido: 30 },
      { cod_empresa: 1, cod_transacao: 10, cod_fatura: 77, os_list: 'A', valor_recebido: 70 },
      { cod_empresa: 1, cod_transacao: 11, cod_fatura: 77, os_list: 'B', valor_recebido: 70 },
    ];
    const out = dedupeFaturaCompartilhada(rows);
    expect(out).toHaveLength(2);
    expect(out.every((r) => r.cod_transacao === 10)).toBe(true);
    expect(out.reduce((s, r) => s + r.valor_recebido, 0)).toBe(100);
  });
});

describe('regime da quitacao de saldo em cartao (venc <> venc original)', () => {
  const sqlBruto = loadSql('recebimentos_detalhe.sql');
  const sql = semComentarios(sqlBruto);

  it('bloco A exclui parcelas de quitacao (vencimento alterado)', () => {
    expect(sql).toMatch(/flp\.datavencimentooriginal\s+IS\s+NULL\s+OR\s+flp\.datavencimento\s*=\s*flp\.datavencimentooriginal/i);
  });

  it('bloco B aceita tipo 3 quando e quitacao de saldo', () => {
    expect(sql).toMatch(/flp\.datavencimentooriginal\s+IS\s+NOT\s+NULL\s+AND\s+flp\.datavencimento\s*<>\s*flp\.datavencimentooriginal/i);
  });

  it('bloco B categoriza a quitacao pela bandeira REAL do cartao', () => {
    const blocoB = sql.slice(sql.indexOf('UNION ALL'));
    expect(blocoB).toMatch(/fcct\.credito\s*=\s*'T'\s+THEN\s+'CARTAO_CREDITO'/i);
    expect(blocoB).toMatch(/'CARTAO_DEBITO'/);
    expect(blocoB).toMatch(/'SALDO A RECEBER'\s+THEN\s+'OUTROS'/i);
  });

  it('expoe valor_emitido e fatura_previsto p/ corte de juros no service', () => {
    expect((sql.match(/AS\s+valor_emitido/gi) || []).length).toBe(2);
    expect((sql.match(/AS\s+fatura_previsto/gi) || []).length).toBe(2);
  });
});

describe('recebimentosService.abaterJurosParcelamento', () => {
  const { abaterJurosParcelamento } = require('../src/services/recebimentosService');

  it('abate o acrescimo embutido do parcelado (base <= valor da venda)', () => {
    // venda 87135: emitido 238,99, parcelas 7x40,63 = 284,41 no cartao credito
    const rows = Array.from({ length: 7 }, (_, i) => ({
      cod_empresa: 1, cod_transacao: 500, cod_fatura: 700,
      forma_categoria: 'CARTAO_CREDITO', valor_recebido: 40.63,
      valor_emitido: 238.99, fatura_previsto: 284.41,
    }));
    const out = abaterJurosParcelamento(rows);
    const soma = out.reduce((s, r) => s + r.valor_recebido, 0);
    expect(Math.abs(soma - 238.99)).toBeLessThan(0.05);
  });

  it('nao mexe quando nao ha excedente', () => {
    const rows = [{ cod_empresa: 1, cod_transacao: 1, cod_fatura: 2, forma_categoria: 'CARTAO_CREDITO', valor_recebido: 100, valor_emitido: 100, fatura_previsto: 100 }];
    expect(abaterJurosParcelamento(rows)[0].valor_recebido).toBe(100);
  });

  it('sem linhas de cartao credito no resultado, nao abate de outras formas', () => {
    const rows = [{ cod_empresa: 1, cod_transacao: 1, cod_fatura: 3, forma_categoria: 'CREDIARIO', valor_recebido: 50, valor_emitido: 200, fatura_previsto: 260 }];
    expect(abaterJurosParcelamento(rows)[0].valor_recebido).toBe(50);
  });

  it('fatura compartilhada: dedup soma o emitido das irmas antes do corte', () => {
    const { dedupeFaturaCompartilhada } = require('../src/services/recebimentosService');
    const rows = [
      { cod_empresa: 1, cod_transacao: 10, cod_fatura: 9, os_list: 'A', forma_categoria: 'CARTAO_CREDITO', valor_recebido: 4709, valor_emitido: 4311, fatura_previsto: 4709 },
      { cod_empresa: 1, cod_transacao: 11, cod_fatura: 9, os_list: 'B', forma_categoria: 'CARTAO_CREDITO', valor_recebido: 4709, valor_emitido: 398, fatura_previsto: 4709 },
    ];
    const out = abaterJurosParcelamento(dedupeFaturaCompartilhada(rows));
    expect(out).toHaveLength(1);
    expect(out[0].valor_emitido).toBe(4709); // 4311 + 398
    expect(out[0].valor_recebido).toBe(4709); // sem excedente falso
  });
});
