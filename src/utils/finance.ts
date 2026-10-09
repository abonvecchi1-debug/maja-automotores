import type { UsdOperation, Sale, InstallmentPayment, Vehicle } from '../types';

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

// ── Reconocimiento de ganancia de las VENTAS de autos ───────────────────────
// Centralizado acá para que Finanzas y el Dashboard calculen EXACTAMENTE lo mismo
// (antes cada uno tenía su propia cuenta y se desincronizaban).

export type SaleProfitEvent = {
  key: string;
  vehicleId: string;
  saleId?: string;
  date: string;        // fecha en que se reconoce la ganancia
  amount: number;      // ganancia reconocida (negativo = pérdida)
  isCuota: boolean;    // true si viene del cobro de una cuota (venta prorrateada)
  installmentNumber?: number;
};

/**
 * Eventos de ganancia de UNA venta.
 * - 'upfront' (ventas viejas y de contado): toda la ganancia (precio − costo) el día de la venta.
 * - 'collected' (financiadas nuevas): la ganancia se reparte proporcionalmente a lo cobrado —
 *   una parte con la entrega el día de la venta y una parte con CADA cuota el día que se cobra.
 *   El costo se prorratea según el peso nominal de cada cobro; la cuota aporta su monto cobrado
 *   real (paidAmount, incluye ajuste por inflación) menos su parte de costo → el recargo/interés
 *   es ganancia extra que entra al cobrar. Las cuotas impagas todavía no reconocen nada.
 */
export function saleProfitEvents(
  vehicle: Pick<Vehicle, 'id' | 'soldPrice' | 'purchasePrice' | 'soldDate'>,
  sale: Sale | undefined,
  payments: InstallmentPayment[],
): SaleProfitEvent[] {
  const cost = vehicle.purchasePrice ?? 0;
  const soldPrice = vehicle.soldPrice ?? sale?.salePrice ?? 0;
  const soldDate = vehicle.soldDate ?? sale?.saleDate ?? '';
  const prorated = !!sale && sale.profitRecognition === 'collected' && sale.paymentType === 'financiado';

  if (!prorated) {
    return [{ key: `venta-${vehicle.id}`, vehicleId: vehicle.id, saleId: sale?.id, date: soldDate, amount: soldPrice - cost, isCuota: false }];
  }

  const down = sale!.downPayment ?? 0;
  const salePays = payments.filter((p) => p.saleId === sale!.id);
  const totalNominal = down + salePays.reduce((a, p) => a + (p.amount ?? 0), 0);
  const costShare = (amt: number) => (totalNominal > 0 ? cost * (amt / totalNominal) : 0);

  const events: SaleProfitEvent[] = [
    { key: `venta-${vehicle.id}`, vehicleId: vehicle.id, saleId: sale!.id, date: soldDate, amount: down - costShare(down), isCuota: false },
  ];
  for (const p of salePays.filter((p) => p.paid && p.paidDate)) {
    const revenue = p.paidAmount ?? p.amount ?? 0;
    events.push({
      key: `cuotagan-${p.id}`, vehicleId: vehicle.id, saleId: sale!.id, date: p.paidDate!,
      amount: revenue - costShare(p.amount ?? 0), isCuota: true, installmentNumber: p.installmentNumber,
    });
  }
  return events;
}

/** Eventos de ganancia de TODAS las ventas (autos vendidos). */
export function allSaleProfitEvents(
  vehicles: Vehicle[],
  sales: Sale[],
  payments: InstallmentPayment[],
): SaleProfitEvent[] {
  const out: SaleProfitEvent[] = [];
  for (const v of vehicles.filter((v) => v.status === 'vendido' && (v.soldDate || v.saleId))) {
    const sale = sales.find((s) => s.id === v.saleId) ?? sales.find((s) => s.vehicleId === v.id);
    out.push(...saleProfitEvents(v, sale, payments));
  }
  return out;
}
