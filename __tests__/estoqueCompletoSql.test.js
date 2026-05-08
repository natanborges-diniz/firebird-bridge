const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(
  path.join(__dirname, '..', 'queries', 'estoque', 'estoque_completo.sql'),
  'utf8'
);

describe('queries/estoque/estoque_completo.sql', () => {
  it('escolhe um único vínculo de fornecedor por SKU antes do SELECT final', () => {
    expect(sql).toMatch(/tbFornecedorPreferencial/i);
    expect(sql).toMatch(/ROW_NUMBER\(\)\s+OVER\s*\(\s*PARTITION BY\s+fornecedor_item\.cod_item/i);
    expect(sql).toMatch(/WHERE\s+fornecedor_rank\.rn\s*=\s*1/i);
    expect(sql).toMatch(/PARTITION BY\s+tbEstoqueCompletoBase\.cod_sku/i);
    expect(sql).toMatch(/data_ultima_entrada\s+DESC\s+NULLS\s+LAST/i);
    expect(sql).toMatch(/fornecedor_nome\s+ASC/i);
    expect(sql).toMatch(/WHERE\s+estoque_rank\.rn\s*=\s*1/i);
  });

  it('mantém o estoque consolidado por produto, sem somar por vínculo no SELECT final', () => {
    expect(sql).toMatch(/tbestoque\.saldo\s+AS\s+quantidade_estoque/i);
    expect(sql).not.toMatch(/SUM\(\s*tbestoque\.saldo\s*\)\s+AS\s+quantidade_estoque/i);
  });

  it('expõe o contrato snake_case esperado pelo endpoint de estoque completo', () => {
    const expectedAliases = [
      'cod_sku',
      'codigo_barras',
      'descricao',
      'fornecedor_nome',
      'grife',
      'quantidade_estoque',
      'preco_custo',
      'preco_venda',
      'data_ultima_entrada',
      'data_ultima_venda',
      'dias_estoque',
      'dias_sem_venda',
      'acao_sugerida',
    ];

    expectedAliases.forEach((alias) => {
      expect(sql).toMatch(new RegExp(`AS\\s+${alias}`, 'i'));
    });
  });
});
