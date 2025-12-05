// src/services/financeiroService.js

// Mesma base usada nos outros services (vendas, estoque, etc.)
const BASE_URL =
  import.meta.env.VITE_FIREBIRD_BRIDGE_BASE_URL ||
  import.meta.env.VITE_FIREBIRD_BRIDGE_URL ||
  '';

if (!BASE_URL) {
  console.warn(
    '[FinanceiroService] VITE_FIREBIRD_BRIDGE_BASE_URL não configurada.'
  );
}

/**
 * Busca parcelas financeiras (pagar/receber) por período e empresa.
 *
 * Parâmetros:
 *  - dataIni: 'YYYY-MM-DD'
 *  - dataFim: 'YYYY-MM-DD'
 *  - empresa: código da empresa (número ou string)
 */
export async function getFinanceiroParcelas({ dataIni, dataFim, empresa }) {
  const search = new URLSearchParams({
    dataIni,
    dataFim,
    empresa: String(empresa),
  });

  const url = `${BASE_URL}/api/v1/financeiro/parcelas?${search.toString()}`;

  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    console.error('[FinanceiroService] Erro ao buscar parcelas:', res.status, text);
    throw new Error(`Erro ao buscar parcelas (${res.status})`);
  }

  const json = await res.json();

  // Backend está devolvendo { ok, count, rows }
  if (json && Array.isArray(json.rows)) {
    return json.rows;
  }

  // fallback se um dia o formato mudar
  if (Array.isArray(json)) return json;

  return [];
}
