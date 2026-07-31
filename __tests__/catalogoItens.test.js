// __tests__/catalogoItens.test.js
//
// Testes de contrato do módulo catálogo (cadastro de produtos, sem estoque).
//   (a) o SQL NÃO pode juntar com a tabela estoque (é cadastro, não prateleira);
//   (b) codigo_barras vem de PRODUTO.CODIGOBARRA (chave estável do sync);
//   (c) EAN (GTIN) só sai validado como 8–14 dígitos;
//   (d) marcador /*__ATIVO_SELECT__*/ presente (checagem de schema em runtime);
//   (e) parseTipoParam aceita alias LENTES, CSV, ALL e rejeita valor inválido.
const fs = require('fs');
const path = require('path');

const { parseTipoParam } = require('../src/services/catalogoService');

const SQL_PATH = path.join(__dirname, '..', 'queries', 'catalogo', 'itens_cadastro.sql');
const sql = fs.readFileSync(SQL_PATH, 'utf8');

describe('queries/catalogo/itens_cadastro.sql', () => {
  it('não junta com a tabela estoque (cadastro puro, sem filtro de saldo)', () => {
    // "estoque" só pode aparecer em comentários (linhas iniciadas por --)
    const codigo = sql
      .split('\n')
      .filter((linha) => !linha.trim().startsWith('--'))
      .join('\n');
    expect(codigo).not.toMatch(/\bJOIN\s+estoque\b/i);
    expect(codigo).not.toMatch(/\bFROM\s+estoque\b/i);
    expect(codigo).not.toMatch(/\bsaldo\b/i);
  });

  it('expõe codigo_barras a partir de PRODUTO.CODIGOBARRA', () => {
    expect(sql).toMatch(/produto\.codigobarra\s+AS\s+codigo_barras/i);
  });

  it('valida EAN (GTIN) como 8–14 dígitos', () => {
    expect(sql).toMatch(/gtin\)\s+SIMILAR TO\s+'\[0-9\]\{8,14\}'/i);
  });

  it('contém os marcadores de runtime exatamente 1 vez cada (nunca em comentários)', () => {
    // Regressão: o marcador escrito num comentário -- fazia o replace de
    // runtime injetar SQL no meio do comentário (Token unknown: item).
    expect(sql.split('/*__ATIVO_SELECT__*/').length - 1).toBe(1);
    expect(sql.split('/*__ROWS__*/').length - 1).toBe(1);
    expect(sql.split('/*__WHERE_TIPO__*/').length - 1).toBe(1);
  });

  it('classifica LG/GC/LC como palavra isolada (mesma heurística do estoque)', () => {
    expect(sql).toMatch(/LIKE\s+'% LG %'/);
    expect(sql).toMatch(/LIKE\s+'% GC %'/);
    expect(sql).toMatch(/LIKE\s+'% LC %'/);
  });

  it('deduplica vínculo de fornecedor por ROW_NUMBER', () => {
    expect(sql).toMatch(/ROW_NUMBER\(\)\s+OVER\s*\(\s*PARTITION BY\s+fornecedor_item\.cod_item/i);
  });
});

describe('catalogoService.parseTipoParam', () => {
  it('sem filtro / ALL retorna null (todos os tipos)', () => {
    expect(parseTipoParam(undefined)).toBeNull();
    expect(parseTipoParam('')).toBeNull();
    expect(parseTipoParam('ALL')).toBeNull();
    expect(parseTipoParam('all')).toBeNull();
  });

  it('alias LENTES expande para grau + contato', () => {
    const tipos = parseTipoParam('LENTES');
    expect([...tipos].sort()).toEqual(['LENTES_CONTATO', 'LENTES_GRAU']);
  });

  it('aceita CSV case-insensitive', () => {
    const tipos = parseTipoParam('armacoes,lentes_grau');
    expect([...tipos].sort()).toEqual(['ARMACOES', 'LENTES_GRAU']);
  });

  it('rejeita tipo desconhecido com code INVALID_TIPO', () => {
    expect(() => parseTipoParam('BANANA')).toThrow(
      expect.objectContaining({ code: 'INVALID_TIPO' })
    );
  });
});
