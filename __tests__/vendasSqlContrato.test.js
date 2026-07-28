// __tests__/vendasSqlContrato.test.js
//
// Testes de contrato dos SQLs de vendas (estilo estoqueCompletoSql.test.js).
// Garantem as padronizações da Fase 0 (docs/REVISAO_VENDAS_METAS.md):
//   (a) D1 — total vendido = TOTAL - VALORDESCONTO - TOTALIPI em todas as queries;
//   (b) D2/D3 — o filtro de período principal usa DATAEMISSAO;
//   (c) D5 — todas contêm o placeholder /*__FILTRO_VENDA_REGULAR__*/ (garantia
//       não é venda; o NOT EXISTS contra vendagarantia_item é injetado em
//       runtime pelo vendasService).
const fs = require('fs');
const path = require('path');

const QUERIES_DIR = path.join(__dirname, '..', 'queries', 'vendas');

const ARQUIVOS = [
  'resumo_empresa_vendedor.sql',
  'resumo_diario_simples.sql',
  'formas_pagamento_resumo.sql',
  'formas_pagamento_auditoria.sql',
  'formas_pagamento_auditoria_light.sql',
  'analise_familia_vendedor.sql',
  'analise_sku.sql',
];

// Filtro de período principal esperado por arquivo (todas em DATAEMISSAO)
const FILTRO_PERIODO_PRINCIPAL = {
  'resumo_empresa_vendedor.sql': /t\.DATAEMISSAO\s+BETWEEN\s+P\.P_DATA_INI\s+AND\s+P\.P_DATA_FIM/i,
  'resumo_diario_simples.sql': /t\.dataemissao\s+BETWEEN\s+\?\s+AND\s+\?/i,
  'formas_pagamento_resumo.sql':
    /transacao\.dataemissao\s+BETWEEN\s+P\.P_DATA_VENDAS_INI\s+AND\s+P\.P_DATA_VENDAS_FIM/i,
  'formas_pagamento_auditoria.sql':
    /transacao\.dataemissao\s+BETWEEN\s+P\.P_DATA_VENDAS_INI\s+AND\s+P\.P_DATA_VENDAS_FIM/i,
  'formas_pagamento_auditoria_light.sql':
    /transacao\.dataemissao\s+BETWEEN\s+P\.P_DATA_VENDAS_INI\s+AND\s+P\.P_DATA_VENDAS_FIM/i,
  'analise_familia_vendedor.sql':
    /t\.DATAEMISSAO\s+BETWEEN\s+CAST\(\?\s+AS\s+DATE\)\s+AND\s+CAST\(\?\s+AS\s+DATE\)/i,
  'analise_sku.sql':
    /t\.DATAEMISSAO\s+BETWEEN\s+CAST\(\?\s+AS\s+DATE\)\s+AND\s+CAST\(\?\s+AS\s+DATE\)/i,
};

const sqls = Object.fromEntries(
  ARQUIVOS.map((nome) => [nome, fs.readFileSync(path.join(QUERIES_DIR, nome), 'utf8')])
);

describe.each(ARQUIVOS)('queries/vendas/%s', (nome) => {
  const sql = sqls[nome];

  it('usa VALORDESCONTO na definição de total vendido (D1)', () => {
    // definição padronizada: TOTAL ... - VALORDESCONTO ... - TOTALIPI
    expect(sql).toMatch(/\bTOTAL\b[\s\S]{0,160}?VALORDESCONTO[\s\S]{0,160}?TOTALIPI/i);

    // regressões conhecidas (TOTAL - TOTALIPI sem o desconto):
    expect(sql).not.toMatch(/COALESCE\(ti\.TOTAL,\s*0\)\s*-\s*COALESCE\(ti\.TOTALIPI,\s*0\)/i);
    expect(sql).not.toMatch(
      /CAST\(COALESCE\(ti\.total,\s*0\)\s+AS\s+DOUBLE\s+PRECISION\)\s*-\s*CAST\(COALESCE\(ti\.totalipi/i
    );
    expect(sql).not.toMatch(/SUM\(ti\.TOTAL\s*-\s*ti\.TOTALIPI\)/i);
  });

  it('filtra o período principal por DATAEMISSAO (D2/D3)', () => {
    expect(sql).toMatch(FILTRO_PERIODO_PRINCIPAL[nome]);
    // o período principal não pode voltar para DATAENCERRAMENTO
    expect(sql).not.toMatch(/DATAENCERRAMENTO\s+BETWEEN\s+P\.P_DATA_INI/i);
    expect(sql).not.toMatch(/DATAENCERRAMENTO\s+BETWEEN\s+P\.P_DATA_VENDAS_INI/i);
    expect(sql).not.toMatch(
      /t\.DATAENCERRAMENTO\s+BETWEEN\s+CAST\(\?\s+AS\s+DATE\)/i
    );
  });

  it('contém o placeholder de venda regular para exclusão de garantia (D5)', () => {
    expect(sql).toContain('/*__FILTRO_VENDA_REGULAR__*/');
  });

  it('não tem o placeholder dentro de comentário -- (bug -104: split/join injetaria bloco multi-linha em SQL solto)', () => {
    const emComentario = sql
      .split('\n')
      .filter((l) => l.trim().startsWith('--'))
      .some((l) => l.includes('__FILTRO_VENDA_REGULAR__'));
    expect(emComentario).toBe(false);
  });
});
