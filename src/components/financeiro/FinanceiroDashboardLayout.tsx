import React from 'react';
import {
  FinanceiroFilters,
  FinanceiroMetrics,
  DailyFlowPoint,
  ParcelaFinanceira,
} from '../../hooks/useFinanceiroDashboard';

export interface FinanceiroDashboardLayoutProps {
  filters: FinanceiroFilters;
  setFilters: React.Dispatch<React.SetStateAction<FinanceiroFilters>>;
  loading: boolean;
  error: string | null;
  parcelas: ParcelaFinanceira[];
  metrics: FinanceiroMetrics;
  dailyFlow: DailyFlowPoint[];
  reload: () => void;
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

const SkeletonRow: React.FC = () => (
  <div className="w-full animate-pulse space-y-2 rounded-lg border bg-white p-4 shadow-sm">
    <div className="h-3 w-32 rounded bg-slate-200" />
    <div className="h-4 w-full rounded bg-slate-200" />
    <div className="h-4 w-5/6 rounded bg-slate-200" />
  </div>
);

export const FinanceiroDashboardLayout: React.FC<FinanceiroDashboardLayoutProps> = ({
  filters,
  setFilters,
  loading,
  error,
  parcelas,
  metrics,
  dailyFlow,
  reload,
}) => {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-600" htmlFor="empresa">
              Empresa
            </label>
            <input
              id="empresa"
              type="number"
              value={filters.empresaId}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, empresaId: Number(e.target.value) }))
              }
              className="w-full rounded border px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 md:w-48"
            />
          </div>

          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-600" htmlFor="dataIni">
                Data inicial
              </label>
              <input
                id="dataIni"
                type="date"
                value={filters.dataIni}
                onChange={(e) => setFilters((prev) => ({ ...prev, dataIni: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600" htmlFor="dataFim">
                Data final
              </label>
              <input
                id="dataFim"
                type="date"
                value={filters.dataFim}
                onChange={(e) => setFilters((prev) => ({ ...prev, dataFim: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={reload}
                className="w-full rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Atualizar
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard title="Receber em aberto" value={metrics.totalReceberAberto} />
          <MetricCard title="Pagar em aberto" value={metrics.totalPagarAberto} />
          <MetricCard title="Atrasos" value={metrics.totalReceberAtrasado + metrics.totalPagarAtrasado} />
          <MetricCard title="Receber em atraso" value={metrics.totalReceberAtrasado} muted />
          <MetricCard title="Pagar em atraso" value={metrics.totalPagarAtrasado} muted />
          <MetricCard title="Total de hoje" value={metrics.totalHoje} />
        </div>
      )}

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Fluxo diário (abertos)</h2>
          <span className="text-xs text-slate-500">Receber x Pagar por vencimento</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Receber</th>
                <th className="px-3 py-2">Pagar</th>
              </tr>
            </thead>
            <tbody>
              {dailyFlow.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-slate-500">
                    Nenhum vencimento no período.
                  </td>
                </tr>
              )}
              {dailyFlow.map((item) => (
                <tr key={item.date} className="border-b last:border-0">
                  <td className="px-3 py-2 text-slate-700">{item.date}</td>
                  <td className="px-3 py-2 text-emerald-700">{formatCurrency(item.receberAberto)}</td>
                  <td className="px-3 py-2 text-amber-700">{formatCurrency(item.pagarAberto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">Parcelas</h2>
          <span className="text-xs text-slate-500">Pagar / Receber</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-slate-500">
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Vencimento</th>
                <th className="px-3 py-2">Valor</th>
                <th className="px-3 py-2">Valor Pago</th>
                <th className="px-3 py-2">Empresa</th>
                <th className="px-3 py-2">Pessoa</th>
                <th className="px-3 py-2">Documento</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-3 text-slate-500">
                    Nenhuma parcela encontrada no período.
                  </td>
                </tr>
              )}
              {parcelas.map((parcela, idx) => (
                <tr key={`${parcela.LANCAMENTONUMERODOCUMENTO}-${idx}`} className="border-b last:border-0">
                  <td className="px-3 py-2 text-slate-700">{parcela.LANCAMENTOPAGAR}</td>
                  <td className="px-3 py-2 text-slate-700">{parcela.PARCELASITUACAO}</td>
                  <td className="px-3 py-2 text-slate-700">{parcela.PARCELADATAVENCIMENTO || '-'}</td>
                  <td className="px-3 py-2 text-slate-700">{formatCurrency(Number(parcela.PARCELAVALOR || 0))}</td>
                  <td className="px-3 py-2 text-slate-700">{formatCurrency(Number(parcela.PARCELAVALORPAGO || 0))}</td>
                  <td className="px-3 py-2 text-slate-700">{parcela.LANCAMENTOEMPRESANOME || '-'}</td>
                  <td className="px-3 py-2 text-slate-700">{parcela.PESSOANOME || '-'}</td>
                  <td className="px-3 py-2 text-slate-700">{parcela.LANCAMENTONUMERODOCUMENTO || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: number;
  muted?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, muted }) => (
  <div
    className={`rounded-lg border bg-white p-4 shadow-sm ${muted ? 'border-slate-200 bg-slate-50' : ''}`}
  >
    <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
    <div className="text-xl font-semibold text-slate-900">{formatCurrency(value)}</div>
  </div>
);

export default FinanceiroDashboardLayout;
