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
    expect(sql.split('/*__WHERE__*/').length - 1).toBe(1);
  });

  it('classifica por COD_PRODUTOTIPO (7 = lentes de grau, 13 = armações)', () => {
    expect(sql).toMatch(/cod_produtotipo\s*=\s*7/i);
    expect(sql).toMatch(/cod_produtotipo\s*=\s*13/i);
  });

  it('classifica LG/GC/LC como palavra isolada (mesma heurística do estoque)', () => {
    expect(sql).toMatch(/LIKE\s+'% LG %'/);
    expect(sql).toMatch(/LIKE\s+'% GC %'/);
    expect(sql).toMatch(/LIKE\s+'% LC %'/);
  });

  it('deduplica vínculo de fornecedor (flag PRINCIPAL + agregação)', () => {
    expect(sql).toMatch(/fornecedor_item\.principal\s*=\s*'T'/i);
    expect(sql).toMatch(/MIN\(pessoafornecedor\.nome\)/i);
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

describe('catalogoService.parseDesdeParam (sync incremental)', () => {
  const { parseDesdeParam } = require('../src/services/catalogoService');

  it('vazio retorna null (carga completa)', () => {
    expect(parseDesdeParam(undefined)).toBeNull();
    expect(parseDesdeParam('')).toBeNull();
  });

  it('aceita YYYY-MM-DD (completa 00:00:00)', () => {
    expect(parseDesdeParam('2026-07-30')).toBe('2026-07-30 00:00:00');
  });

  it('aceita data com hora (T ou espaço)', () => {
    expect(parseDesdeParam('2026-07-30T05:00:00')).toBe('2026-07-30 05:00:00');
    expect(parseDesdeParam('2026-07-30 05:00')).toBe('2026-07-30 05:00');
  });

  it('rejeita formato inválido com code INVALID_DESDE (anti-injeção)', () => {
    for (const ruim of ['ontem', '2026/07/30', "2026-07-30'; DROP TABLE x--", '30-07-2026']) {
      expect(() => parseDesdeParam(ruim)).toThrow(
        expect.objectContaining({ code: 'INVALID_DESDE' })
      );
    }
  });
});
