// src/services/syncEstoqueService.js
// Sincroniza estoque do Firebird → Supabase (tabela estoque_sincronizado).
// Responsabilidade: query Firebird, calcular derivados, upsert em batches, limpeza.

const { createClient } = require('@supabase/supabase-js');
const estoqueService = require('./estoqueService');

const EMPRESAS_ATIVAS = [1, 2, 4, 6, 9, 10, 13, 14, 15, 16, 17, 18];
const BATCH_SIZE = 500;
const THROTTLE_ENTRE_LOJAS_MS = 1000;
const TIMEOUT_FIREBIRD_MS = 180_000;  // 3min por chamada Firebird
const TIMEOUT_EMPRESA_MS  = 300_000;  // 5min por empresa (total)

// Rejeita com erro de timeout se a promise não resolver dentro de ms.
function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

// ============================================================
// FAIXAS DE SANEAMENTO (Princípio #31)
// Espelho de faixas-saneamento no Frontend.
// ATENÇÃO: ao mudar aqui, atualizar também no Frontend.
// ============================================================

const FAIXAS_SANEAMENTO = [
  { rotulo: 'ANALISE PARA RECOMPRA', desconto: 0,  diasMin: 0,   diasMax: 90 },
  { rotulo: 'ACOMPANHAMENTO',        desconto: 0,  diasMin: 91,  diasMax: 180 },
  { rotulo: 'PROMOCAO 20%',          desconto: 20, diasMin: 181, diasMax: 270 },
  { rotulo: 'LIQUIDA 30%',           desconto: 30, diasMin: 271, diasMax: 360 },
  { rotulo: 'LIQUIDA 50%',           desconto: 50, diasMin: 361, diasMax: 720 },
  { rotulo: 'ACAO ESPECIAL',         desconto: 0,  diasMin: 721, diasMax: Number.MAX_SAFE_INTEGER },
];

function classificarPorIdade(dias) {
  if (dias == null || dias < 0) return null;
  return FAIXAS_SANEAMENTO.find(f => dias >= f.diasMin && dias <= f.diasMax) ?? null;
}

// Princípio #31: dead stock usa diasDesdeUltimaVenda; demais usam diasEmEstoque.
// Dead stock: tem data de última venda, mas faz >180 dias sem vender.
function classificarItemP31(r) {
  const isDeadStock = r.dias_sem_venda != null && r.dias_sem_venda > 180;
  const dias = isDeadStock
    ? (r.dias_sem_venda ?? r.dias_estoque)
    : r.dias_estoque;
  return { faixa: classificarPorIdade(dias), isDeadStock };
}

// ============================================================
// CLIENTE SUPABASE
// ============================================================

// Node 20 não tem WebSocket nativo — necessário para @supabase/realtime-js.
// Usamos apenas REST (upsert/delete), mas o cliente inicializa Realtime na
// construção e falha sem WebSocket. ws resolve sem abrir conexão real.
const WebSocket = require('ws');

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes');
  return createClient(url, key, {
    realtime: { transport: WebSocket },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ============================================================
// SYNC DE UMA EMPRESA
// ============================================================

async function syncEmpresa(empresa, supabase, startedAt) {
  try {
    console.log(`[sync-estoque] empresa ${empresa}: iniciando`);

    // 1. Buscar dados Firebird em paralelo (180s de timeout por chamada)
    // lowercase_keys: true já está configurado em db/index.js — campos chegam em minúsculas.
    const [estoqueRows, custoRows] = await Promise.all([
      withTimeout(estoqueService.getEstoqueCompleto(String(empresa)),    TIMEOUT_FIREBIRD_MS, `getEstoqueCompleto(${empresa})`),
      withTimeout(estoqueService.getEstoqueUltimoCusto(String(empresa)), TIMEOUT_FIREBIRD_MS, `getEstoqueUltimoCusto(${empresa})`),
    ]);

    // 2. Indexar custos por cod_sku para lookup O(1)
    const custoMap = new Map();
    for (const c of (custoRows || [])) {
      custoMap.set(Number(c.cod_sku), c);
    }

    // 3. Mapear para o schema de estoque_sincronizado
    // Mapeamento de campos Firebird → Supabase:
    //   tipo            → categoria
    //   fornecedor_nome → fornecedor
    //   grife           → marca
    //   preco_custo     → preco_custo (custo unitário vindo do Firebird)
    //   dias_estoque    → dias_em_estoque
    //   dias_sem_venda  → dias_desde_ultima_venda
    //   pecas_vendidas_consideradas → qtd_vendidos_180d
    const rowsParaUpsert = (estoqueRows || []).map(r => {
      const custo = custoMap.get(Number(r.cod_sku));
      const isArmacao = r.tipo === 'ARMACOES';

      let faixa = null;
      let isDeadStock = false;
      if (isArmacao) {
        const resultado = classificarItemP31(r);
        faixa = resultado.faixa;
        isDeadStock = resultado.isDeadStock;
      }

      const precoCusto = r.preco_custo > 0 ? r.preco_custo : null;
      const valorEstoqueCusto = precoCusto != null
        ? Number((precoCusto * r.quantidade_estoque).toFixed(2))
        : null;

      return {
        cod_empresa:              empresa,
        cod_sku:                  Number(r.cod_sku),
        descricao:                r.descricao || null,
        marca:                    r.grife || null,
        fornecedor:               r.fornecedor_nome || null,
        categoria:                r.tipo || null,
        subcategoria:             r.subcategoria || null,
        cod_barras_interno:       r.cod_barras_interno || null,
        ean:                      r.ean || null,
        quantidade_estoque:       r.quantidade_estoque,
        valor_estoque_custo:      valorEstoqueCusto,
        custo_ultima_compra:      custo?.custo_ultima_compra ?? null,
        data_ultima_compra:       custo?.data_ultima_compra ?? null,
        origem_custo:             custo?.origem_custo ?? null,
        data_ultima_entrada:      r.data_ultima_entrada ?? null,
        data_ultima_venda:        r.data_ultima_venda ?? null,
        dias_em_estoque:          r.dias_estoque ?? null,
        dias_desde_ultima_venda:  r.dias_sem_venda ?? null,
        qtd_vendidos_180d:        r.pecas_vendidas_consideradas ?? 0,
        is_dead_stock:            isDeadStock,
        faixa_saneamento:         faixa?.rotulo ?? null,
        acao_sugerida:            faixa?.rotulo ?? null,
        desconto_sugerido:        faixa?.desconto ?? null,
        atualizado_em:            new Date().toISOString(),
      };
    });

    console.log(`[sync-estoque] empresa ${empresa}: ${rowsParaUpsert.length} SKUs`);

    // 4. UPSERT em batches
    for (let i = 0; i < rowsParaUpsert.length; i += BATCH_SIZE) {
      const batch = rowsParaUpsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from('estoque_sincronizado')
        .upsert(batch, { onConflict: 'cod_empresa,cod_sku' });
      if (error) throw new Error(`Upsert batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
    }

    // 5. Deletar SKUs que saíram do estoque nesta rodada (não foram tocados pelo upsert)
    const { error: deleteError } = await supabase
      .from('estoque_sincronizado')
      .delete()
      .eq('cod_empresa', empresa)
      .lt('atualizado_em', startedAt);

    if (deleteError) {
      console.warn(`[sync-estoque] empresa ${empresa}: delete de obsoletos falhou: ${deleteError.message}`);
    }

    console.log(`[sync-estoque] empresa ${empresa}: concluído`);
    return { empresa, registros: rowsParaUpsert.length, erro: null };

  } catch (err) {
    console.error(`[sync-estoque] empresa ${empresa}: ERRO:`, err.message);
    return { empresa, registros: 0, erro: err.message };
  }
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

async function syncTodasEmpresas(empresaOpcional = null) {
  const startedAt = new Date().toISOString();
  console.log(`[sync-estoque] START ${startedAt}`);

  const supabase = getSupabase();
  const empresas = empresaOpcional != null ? [Number(empresaOpcional)] : EMPRESAS_ATIVAS;
  const resultados = [];

  for (let i = 0; i < empresas.length; i++) {
    let resultado;
    try {
      resultado = await withTimeout(
        syncEmpresa(empresas[i], supabase, startedAt),
        TIMEOUT_EMPRESA_MS,
        `syncEmpresa(${empresas[i]})`
      );
    } catch (err) {
      console.error(`[sync-estoque] empresa ${empresas[i]}: timeout geral:`, err.message);
      resultado = { empresa: empresas[i], registros: 0, erro: err.message };
    }
    resultados.push(resultado);
    if (i < empresas.length - 1) {
      await new Promise(resolve => setTimeout(resolve, THROTTLE_ENTRE_LOJAS_MS));
    }
  }

  const totalRegistros = resultados.reduce((acc, r) => acc + r.registros, 0);
  const totalErros = resultados.filter(r => r.erro).length;
  const finishedAt = new Date().toISOString();

  // Atualizar etl_controle
  await supabase
    .from('etl_controle')
    .upsert({
      entidade:     'estoque_sincronizado',
      ultima_data:  new Date().toISOString().split('T')[0],
      atualizado_em: finishedAt,
    }, { onConflict: 'entidade' });

  console.log(`[sync-estoque] DONE ${finishedAt}. registros=${totalRegistros} erros=${totalErros}`);

  return {
    ok:              totalErros === 0,
    started_at:      startedAt,
    finished_at:     finishedAt,
    total_registros: totalRegistros,
    total_erros:     totalErros,
    detalhe:         resultados,
  };
}

module.exports = { syncTodasEmpresas };
