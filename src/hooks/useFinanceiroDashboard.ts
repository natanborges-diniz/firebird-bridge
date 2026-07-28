// src/hooks/useFinanceiroDashboard.ts
import { useEffect, useMemo, useState } from 'react';
import { getFinanceiroParcelas } from '../services/financeiroService';

// Interface dos campos que realmente usamos no front.
// Contrato real de queries/financeiro/financeiro_parcelas.sql (D12):
// chaves minúsculas (snake_case) e situação 'EM ABERTO' | 'EM ATRASO' | 'PAGA'.
export interface ParcelaFinanceira {
  lancamento_pagar: 'T' | 'F' | string; // 'T' = PAGAR, 'F' = RECEBER
  parcela_situacao: 'EM ABERTO' | 'EM ATRASO' | 'PAGA' | string;
  parcela_data_vencimento: string | null;
  parcela_valor: number;
  parcela_valor_pago: number | null;

  parcela_data_emissao?: string | null;
  lancamento_documento?: string | null;
  empresa_nome?: string | null;
  empresa_nome_logico?: string | null;
  pessoa_nome?: string | null;
  [key: string]: any;
}

export interface FinanceiroFilters {
  empresaId: number;
  dataIni: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
}

export interface FinanceiroMetrics {
  totalReceberAberto: number;
  totalPagarAberto: number;
  totalReceberAtrasado: number;
  totalPagarAtrasado: number;
  totalHoje: number;
}

export interface DailyFlowPoint {
  date: string; // YYYY-MM-DD
  receberAberto: number;
  pagarAberto: number;
}

function parseDate(value: any): Date | null {
  if (!value) return null;
  try {
    return new Date(value);
  } catch {
    return null;
  }
}

function yyyymmdd(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeMetrics(parcelas: ParcelaFinanceira[]): {
  metrics: FinanceiroMetrics;
  dailyFlow: DailyFlowPoint[];
} {
  const hoje = new Date();
  const hojeStr = yyyymmdd(hoje);

  let totalReceberAberto = 0;
  let totalPagarAberto = 0;
  let totalReceberAtrasado = 0;
  let totalPagarAtrasado = 0;
  let totalHoje = 0;

  const byDate = new Map<string, { receber: number; pagar: number }>();

  for (const p of parcelas) {
    // lancamento_pagar: 'T' = PAGAR, 'F' = RECEBER (contrato da SQL)
    const tipo =
      String(p.lancamento_pagar || '').trim().toUpperCase() === 'T' ? 'PAGAR' : 'RECEBER';
    // parcela_situacao: 'EM ABERTO' | 'EM ATRASO' | 'PAGA'
    const situacao = String(p.parcela_situacao || '').trim().toUpperCase();
    const valor = Number(p.parcela_valor || 0);

    const dtVenc = parseDate(p.parcela_data_vencimento);
    const dtStr = dtVenc ? yyyymmdd(dtVenc) : null;

    // aberta = ainda não paga (inclui as em atraso)
    const isAberta = situacao === 'EM ABERTO' || situacao === 'EM ATRASO';

    if (tipo === 'RECEBER' && isAberta) {
      totalReceberAberto += valor;
    }

    if (tipo === 'PAGAR' && isAberta) {
      totalPagarAberto += valor;
    }

    if (dtVenc && isAberta) {
      if (dtStr! < hojeStr) {
        if (tipo === 'RECEBER') totalReceberAtrasado += valor;
        if (tipo === 'PAGAR') totalPagarAtrasado += valor;
      }
      if (dtStr === hojeStr) {
        totalHoje += valor;
      }
    }

    if (dtStr && isAberta) {
      if (!byDate.has(dtStr)) {
        byDate.set(dtStr, { receber: 0, pagar: 0 });
      }
      const agg = byDate.get(dtStr)!;
      if (tipo === 'RECEBER') agg.receber += valor;
      if (tipo === 'PAGAR') agg.pagar += valor;
    }
  }

  const dailyFlow: DailyFlowPoint[] = Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, v]) => ({
      date,
      receberAberto: v.receber,
      pagarAberto: v.pagar,
    }));

  return {
    metrics: {
      totalReceberAberto,
      totalPagarAberto,
      totalReceberAtrasado,
      totalPagarAtrasado,
      totalHoje,
    },
    dailyFlow,
  };
}

export function useFinanceiroDashboard(initialEmpresaId: number) {
  const hoje = useMemo(() => new Date(), []);
  const fimDefault = yyyymmdd(hoje);
  const iniDefault = yyyymmdd(
    new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 60)
  );

  const [filters, setFilters] = useState<FinanceiroFilters>({
    empresaId: initialEmpresaId,
    dataIni: iniDefault,
    dataFim: fimDefault,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<ParcelaFinanceira[]>([]);

  async function reload() {
    if (!filters.empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getFinanceiroParcelas({
        dataIni: filters.dataIni,
        dataFim: filters.dataFim,
        empresa: filters.empresaId,
      });
      setParcelas(data);
    } catch (err: any) {
      console.error('[Financeiro] Erro ao carregar parcelas:', err);
      setError(err?.message || 'Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.empresaId, filters.dataIni, filters.dataFim]);

  const { metrics, dailyFlow } = useMemo(
    () => computeMetrics(parcelas),
    [parcelas]
  );

  return {
    filters,
    setFilters,
    loading,
    error,
    parcelas,
    metrics,
    dailyFlow,
    reload,
  };
}
