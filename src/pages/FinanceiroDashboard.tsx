// src/pages/FinanceiroDashboard.tsx
import React from 'react';
import { useFinanceiroDashboard } from '../hooks/useFinanceiroDashboard';
import { FinanceiroDashboardLayout } from '../components/financeiro/FinanceiroDashboardLayout';

const DEFAULT_EMPRESA = 1; // você pode trocar depois

const FinanceiroDashboard: React.FC = () => {
  const {
    filters,
    setFilters,
    loading,
    error,
    parcelas,
    metrics,
    dailyFlow,
  } = useFinanceiroDashboard(DEFAULT_EMPRESA);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto py-6">
        <h1 className="text-lg font-semibold mb-4">
          Dashboard Financeiro - Parcelas (Pagar/Receber)
        </h1>
        <FinanceiroDashboardLayout
          filters={filters}
          setFilters={setFilters}
          loading={loading}
          error={error}
          parcelas={parcelas}
          metrics={metrics}
          dailyFlow={dailyFlow}
        />
      </div>
    </div>
  );
};

export default FinanceiroDashboard;
