import type { UsdOperation } from '../types';

/**
 * Ganancia realizada de cada VENTA de dólares (precio de venta − costo promedio de compra).
 * Recorre las operaciones en orden cronológico llevando la tenencia y el pozo de costo, igual
 * que el apartado Dólares. Devuelve una entrada por venta con su fecha y su ganancia (puede ser
 * negativa si se vendió por debajo del promedio). Se usa tanto en Finanzas como en el Dashboard
 * para que la ganancia de dólares se refleje igual en los dos.
 */
export function usdRealizedProfits(usdOperations: UsdOperation[]): { id: string; date: string; profit: number }[] {
  const sorted = [...usdOperations].sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  let holdings = 0, pool = 0;
  const out: { id: string; date: string; profit: number }[] = [];
  for (const o of sorted) {
    if (o.type === 'compra') {
      holdings += o.amountUsd;
      pool += o.amountPesos;
    } else {
      const avg = holdings > 0 ? pool / holdings : 0;
      const profit = o.amountPesos - o.amountUsd * avg;
      pool -= o.amountUsd * avg;
      holdings -= o.amountUsd;
      out.push({ id: o.id, date: o.date, profit });
    }
  }
  return out;
}

/** Ganancia de dólares realizada en un mes dado (formato 'YYYY-MM'). */
export function usdProfitInMonth(usdOperations: UsdOperation[], month: string): number {
  return usdRealizedProfits(usdOperations)
    .filter((p) => (p.date || '').startsWith(month))
    .reduce((a, p) => a + p.profit, 0);
}
