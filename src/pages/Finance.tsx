import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Car, CheckCircle, Clock, Wallet, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStore } from '../store';
import { LIQUID_METHODS } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { confirmDialog, notify } from '../components/ui/Feedback';
import { formatCurrency, formatDate, getCurrentMonth, formatMonthLabel } from '../utils/formatters';
import { usdRealizedProfits } from '../utils/finance';

const INCOME_CATEGORIES = [
  { value: 'venta_contado', label: 'Venta al contado' },
  { value: 'cuota', label: 'Cobro de cuota' },
  { value: 'seña', label: 'Seña / Entrega' },
  { value: 'otro_ingreso', label: 'Otro ingreso' },
];

const EXPENSE_CATEGORIES = [
  { value: 'compra_vehiculo', label: 'Compra de vehículo' },
  { value: 'gasto_vehiculo', label: 'Gasto de preparación' },
  { value: 'gasto_fijo', label: 'Gasto fijo del negocio' },
  { value: 'proveedor', label: 'Pago a proveedor' },
  { value: 'impuesto', label: 'Impuesto / IIBB' },
  { value: 'otro_egreso', label: 'Otro egreso' },
];

const INITIAL_FORM = {
  type: 'ingreso' as 'ingreso' | 'egreso',
  category: 'venta_contado',
  amount: 0,
  description: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  paid: true,
  method: 'efectivo' as 'efectivo' | 'cheque' | 'dolares', // medio de pago (solo egresos)
  payee: '',      // a quién le pagué (opcional)
  usdAmount: 0,   // dólares usados si method === 'dolares'
};

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo / banco' },
  { value: 'cheque', label: 'Cheque de cartera' },
  { value: 'dolares', label: 'Dólares' },
] as const;

const categoryLabel: Record<string, string> = {
  venta_contado: 'Venta contado',
  venta_vehiculo: 'Venta de vehículo',
  ganancia_venta: 'Ganancia de venta',
  perdida_venta: 'Pérdida de venta',
  ganancia_dolares: 'Ganancia dólares',
  perdida_dolares: 'Pérdida dólares',
  cuota: 'Cuota',
  seña: 'Seña',
  otro_ingreso: 'Otro ingreso',
  compra_vehiculo: 'Compra vehículo',
  gasto_vehiculo: 'Gasto preparación',
  gasto_fijo: 'Gasto fijo',
  proveedor: 'Proveedor',
  impuesto: 'Impuesto',
  otro_egreso: 'Otro egreso',
};

/** Movimiento unificado de todas las fuentes de dinero (igual criterio que Reportes). */
type MovSource = 'venta' | 'costo' | 'tx' | 'gasto' | 'fijo' | 'impuesto' | 'dolares';
type Movement = {
  key: string;
  source: MovSource;
  type: 'ingreso' | 'egreso';
  category: string;
  description: string;
  amount: number;
  date: string;
  paid: boolean;
  paidDate?: string;
  txId?: string;        // id de la transacción manual (para pagar / eliminar)
  vehicleId?: string;   // id del vehículo (ventas / costo)
  payee?: string;       // a quién se le pagó (egresos manuales)
  method?: 'efectivo' | 'cheque' | 'dolares'; // medio de pago (egresos manuales)
};

const sourceTag: Record<MovSource, string> = {
  venta: 'Venta', costo: 'Costo auto', tx: 'Finanzas', gasto: 'Gasto', fijo: 'Gasto fijo', impuesto: 'Impuesto', dolares: 'Dólares',
};

export function Finance() {
  const { transactions, vehicles, sales, installmentPayments, cheques, expenses, fixedExpenseRecords, taxPayments, usdOperations, capitalAssets, addTransaction, addExpenseWithPayment, deleteExpenseTransaction, markTransactionPaid } = useStore();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [payChequeIds, setPayChequeIds] = useState<string[]>([]);
  const [monthFilter, setMonthFilter] = useState(getCurrentMonth());
  const [onlyPending, setOnlyPending] = useState(false);

  // Generate last 12 months for selector
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = d.toISOString().slice(0, 7);
    return { value: val, label: formatMonthLabel(val) };
  });

  // ── Movimientos: TODAS las fuentes (mismo criterio que Reportes) ───────────
  const movements: Movement[] = [];
  // Ventas (ingreso) y costo de compra del auto vendido (egreso), imputados al mes de venta
  for (const v of vehicles.filter((v) => v.status === 'vendido' && v.soldDate)) {
    // La venta se marca por su GANANCIA (precio − costo), no por el precio total. Comprar el
    // auto no fue un gasto (fue capital), así que su costo NO figura como egreso: ya está
    // descontado dentro de la ganancia. Si vendiste a pérdida, se marca como egreso.
    const resultado = (v.soldPrice ?? 0) - (v.purchasePrice ?? 0);
    movements.push({
      key: `venta-${v.id}`, source: 'venta',
      type: resultado >= 0 ? 'ingreso' : 'egreso',
      category: resultado >= 0 ? 'ganancia_venta' : 'perdida_venta',
      description: `${resultado >= 0 ? 'Ganancia' : 'Pérdida'} · ${v.brand} ${v.model}${v.year ? ' ' + v.year : ''}`.trim(),
      amount: Math.abs(resultado), date: v.soldDate!, paid: true, vehicleId: v.id,
    });
  }
  // Transacciones manuales de Finanzas (el "saldo inicial" no es un movimiento del mes)
  for (const t of transactions) {
    if (t.category === 'saldo_inicial') continue;
    movements.push({
      key: `tx-${t.id}`, source: 'tx', type: t.type, category: t.category, description: t.description,
      amount: t.amount, date: t.date, paid: t.type === 'ingreso' ? true : (t.paid ?? true), paidDate: t.paidDate, txId: t.id,
      payee: t.payee, method: t.paymentMethod,
    });
  }
  // Gastos variables (gastos de vehículos / proveedores)
  for (const e of expenses) {
    movements.push({
      key: `gasto-${e.id}`, source: 'gasto', type: 'egreso', category: e.category,
      description: e.description, amount: e.amount, date: e.date, paid: e.paid, paidDate: e.paidDate, vehicleId: e.vehicleId,
    });
  }
  // Gastos fijos del mes
  for (const r of fixedExpenseRecords) {
    movements.push({
      key: `fijo-${r.id}`, source: 'fijo', type: 'egreso', category: 'gasto_fijo',
      description: r.typeName, amount: r.amount, date: r.dueDate || `${r.month}-01`, paid: r.paid, paidDate: r.paidDate,
    });
  }
  // Impuestos pagados
  for (const t of taxPayments.filter((t) => t.paid && t.paidDate)) {
    movements.push({
      key: `imp-${t.id}`, source: 'impuesto', type: 'egreso', category: 'impuesto',
      description: t.description, amount: t.amount, date: t.paidDate!, paid: true, paidDate: t.paidDate,
    });
  }
  // Ganancia (o pérdida) por venta de dólares, imputada al mes de cada venta.
  for (const p of usdRealizedProfits(usdOperations)) {
    if (Math.abs(p.profit) < 0.5) continue;
    movements.push({
      key: `usd-${p.id}`, source: 'dolares',
      type: p.profit >= 0 ? 'ingreso' : 'egreso',
      category: p.profit >= 0 ? 'ganancia_dolares' : 'perdida_dolares',
      description: p.profit >= 0 ? 'Ganancia por venta de dólares' : 'Pérdida por venta de dólares',
      amount: Math.abs(p.profit), date: p.date, paid: true,
    });
  }

  // Un egreso cuenta salvo que sea una transacción manual de Finanzas sin pagar
  // (los gastos variables, fijos e impuestos cuentan igual que en Reportes).
  const countsAsExpense = (m: Movement) => m.type === 'egreso' && !(m.source === 'tx' && !m.paid);

  const filtered = movements
    .filter((m) => !monthFilter || m.date.startsWith(monthFilter))
    .filter((m) => !onlyPending || (m.type === 'egreso' && !m.paid))
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthMovements = movements.filter((m) => !monthFilter || m.date.startsWith(monthFilter));
  const monthIncome = monthMovements.filter((m) => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0);
  const monthExpense = monthMovements.filter(countsAsExpense).reduce((a, m) => a + m.amount, 0);
  const monthUtilidad = monthIncome - monthExpense;
  const pendingExpense = monthMovements.filter((m) => m.type === 'egreso' && !m.paid).reduce((a, m) => a + m.amount, 0);
  const pendingCount = monthMovements.filter((m) => m.type === 'egreso' && !m.paid).length;

  // Chart data — mismo criterio comprehensivo, por mes
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('es-AR', { month: 'short' });
    const mov = movements.filter((x) => x.date.startsWith(m));
    const ingresos = mov.filter((x) => x.type === 'ingreso').reduce((a, x) => a + x.amount, 0);
    const egresos = mov.filter(countsAsExpense).reduce((a, x) => a + x.amount, 0);
    return { mes: label, Ingresos: Math.round(ingresos / 1000), Egresos: Math.round(egresos / 1000) };
  });

  const categories = form.type === 'ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // ── Disponibilidad (snapshot total de caja, no depende del mes) ────────────
  // Anclado a un "saldo inicial": lo que había en caja a una fecha (transacción con
  // categoría 'saldo_inicial'). Todo lo anterior a esa fecha queda absorbido en ese
  // saldo; de ahí en más suma lo que entra y resta lo que sale. Sin saldo inicial
  // cargado, se comporta como antes (cuenta todo el historial).
  const isLiquid = (m?: string) => !!m && LIQUID_METHODS.includes(m as never);
  const anchorTxs = transactions.filter((t) => t.category === 'saldo_inicial');
  const openingBalance = anchorTxs.reduce((a, t) => a + t.amount, 0);
  const anchorDate = anchorTxs.reduce((a, t) => (t.date > a ? t.date : a), '');
  const after = (d?: string) => !anchorDate || (!!d && d > anchorDate);

  let saleLiquid = 0;
  for (const v of vehicles.filter((v) => v.status === 'vendido' && after(v.soldDate))) {
    const sale = sales.find((s) => s.id === v.saleId) ?? sales.find((s) => s.vehicleId === v.id);
    if (sale?.paymentMethods?.length) {
      saleLiquid += sale.paymentMethods.filter((p) => isLiquid(p.method)).reduce((a, p) => a + p.amount, 0);
    } else if (sale) {
      saleLiquid += sale.paymentType === 'financiado'
        ? (sale.downPayment ?? 0)
        : Math.max(0, (sale.salePrice ?? v.soldPrice ?? 0) - (sale.tradeInValue ?? 0));
    } else {
      const tradeInVal = v.tradeInVehicleId ? (vehicles.find((x) => x.id === v.tradeInVehicleId)?.purchasePrice ?? 0) : 0;
      saleLiquid += Math.max(0, (v.soldPrice ?? 0) - tradeInVal);
    }
  }
  const collectedInstallments = installmentPayments.filter((p) => p.paid && after(p.paidDate)).reduce((a, p) => a + (p.paidAmount ?? p.amount), 0);
  const manualIncome = transactions.filter((t) => t.type === 'ingreso' && t.category !== 'saldo_inicial' && after(t.date)).reduce((a, t) => a + t.amount, 0);
  const senaVentaActiva = vehicles
    .filter((v) => v.status === 'señado' && v.senaType === 'venta' && (v.senaAmount ?? 0) > 0 && isLiquid(v.senaMethod) && after(v.senaDate))
    .reduce((a, v) => a + (v.senaAmount ?? 0), 0);
  const senaCompra = vehicles
    .filter((v) => v.status === 'señado' && v.senaType === 'compra' && (v.senaAmount ?? 0) > 0 && isLiquid(v.senaMethod) && after(v.senaDate))
    .reduce((a, v) => a + (v.senaAmount ?? 0), 0);
  // Comprar autos NO es un gasto: la plata pasa a CAPITAL (stock). Del disponible solo se
  // descuentan las compras POSTERIORES al saldo inicial (las de antes ya están en ese saldo).
  // Si parte de la compra se pagó con un cheque de cartera, esa parte la pagó el cheque (que
  // ya salió del disponible al pasar a "entregado"), así que no se descuenta de nuevo.
  const chequePagoAuto = (vid: string) => cheques
    .filter((c) => c.moneda === 'ARS' && c.estado === 'entregado' && c.purchaseVehicleId === vid)
    .reduce((a, c) => a + c.monto, 0);
  const comprasVehiculos = vehicles
    .filter((v) => v.acquiredAs !== 'parte_pago' && !(v.status === 'señado' && v.senaType === 'compra') && after(v.purchaseDate))
    .reduce((a, v) => a + Math.max(0, (v.purchasePrice ?? 0) - chequePagoAuto(v.id)), 0);
  // Bienes de capital (trailer, etc.): igual que un auto → suman al Capital y descuentan del
  // Disponible su parte en pesos (valor − cheques usados), solo los comprados post-ancla.
  const chequePagoBien = (aid: string) => cheques
    .filter((c) => c.moneda === 'ARS' && c.estado === 'entregado' && c.purchaseAssetId === aid)
    .reduce((a, c) => a + c.monto, 0);
  const comprasCapital = capitalAssets
    .filter((x) => after(x.purchaseDate))
    .reduce((a, x) => a + Math.max(0, (x.value ?? 0) - chequePagoBien(x.id)), 0);
  // Cheques recibidos en cartera/depositados/cobrados = plata a cobrar → suman al disponible.
  // Los entregados/endosados (usados para pagar) y los rechazados no cuentan.
  const chequesDisponibles = cheques
    .filter((c) => c.moneda === 'ARS' && ['en_cartera', 'depositado', 'cobrado'].includes(c.estado))
    .reduce((a, c) => a + c.monto, 0);
  // Los egresos cuentan post-ancla por su FECHA DE PAGO (cuándo salió la plata), no por
  // fecha nominal/vencimiento: un gasto con vencimiento futuro pero ya pagado antes del
  // saldo inicial ya está descontado del efectivo → no se resta de nuevo.
  // Cheques de cartera entregados para pagar un gasto puntual (no descuenta doble el gasto).
  const chequePagoTx = (txId: string) => cheques
    .filter((c) => c.moneda === 'ARS' && c.estado === 'entregado' && c.purchaseTransactionId === txId)
    .reduce((a, c) => a + c.monto, 0);
  const manualPaidExpense = transactions
    .filter((t) => t.type === 'egreso' && t.paid !== false && after(t.paidDate ?? t.date))
    .reduce((a, t) => {
      // Pagado con dólares: lo pagó la tenencia de dólares (que ya bajó), no el efectivo → no resta.
      if (t.paymentMethod === 'dolares') return a;
      // Pagado con cheque de cartera: el cheque ya salió del disponible al pasar a "entregado";
      // solo resta la parte que se pagó en efectivo (si el cheque no cubrió todo).
      if (t.paymentMethod === 'cheque') return a + Math.max(0, t.amount - chequePagoTx(t.id));
      return a + t.amount;
    }, 0);
  const gastosVarPaid = expenses.filter((e) => e.paid && after(e.paidDate ?? e.date)).reduce((a, e) => a + e.amount, 0);
  const gastosFijosPaid = fixedExpenseRecords.filter((r) => r.paid && after(r.paidDate ?? (r.dueDate || `${r.month}-01`))).reduce((a, r) => a + r.amount, 0);
  const impuestosPaid = taxPayments.filter((t) => t.paid && after(t.paidDate)).reduce((a, t) => a + t.amount, 0);

  const disponible = openingBalance + saleLiquid + collectedInstallments + manualIncome + senaVentaActiva + chequesDisponibles
    - manualPaidExpense - gastosVarPaid - gastosFijosPaid - impuestosPaid - senaCompra - comprasVehiculos - comprasCapital;

  // Capital = costo de los autos en stock + los bienes de capital (trailer, etc.). No es gasto.
  const capital = vehicles.filter((v) => v.status !== 'vendido').reduce((a, v) => a + (v.purchasePrice ?? 0), 0)
    + capitalAssets.reduce((a, x) => a + (x.value ?? 0), 0);

  // Cheques a cobrar (pendientes) — ya están dentro del disponible; se muestran a la vista.
  const chequesEnCarteraEstados = ['en_cartera', 'depositado'];
  const chequesACobrar = cheques.filter((c) => c.moneda === 'ARS' && chequesEnCarteraEstados.includes(c.estado)).reduce((a, c) => a + c.monto, 0);
  const chequesACobrarCount = cheques.filter((c) => c.moneda === 'ARS' && chequesEnCarteraEstados.includes(c.estado)).length;

  // Disponible en dólares (tenencia del módulo Dólares) + su valor en pesos al promedio.
  let usdHoldings = 0, usdPool = 0;
  for (const o of [...usdOperations].sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt))) {
    if (o.type === 'compra') { usdHoldings += o.amountUsd; usdPool += o.amountPesos; }
    else { const avg = usdHoldings > 0 ? usdPool / usdHoldings : 0; usdPool -= o.amountUsd * avg; usdHoldings -= o.amountUsd; }
  }
  usdHoldings = Math.max(0, usdHoldings); usdPool = Math.max(0, usdPool);
  const usdAvgCost = usdHoldings > 0.0001 ? usdPool / usdHoldings : 0;
  const fmtUSD = (n: number) => 'U$S ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

  // Cheques ARS en cartera disponibles para pagar un gasto.
  const carteraCheques = cheques.filter((c) => c.moneda === 'ARS' && c.estado === 'en_cartera');
  const usdExpensePesos = Math.round((form.usdAmount || 0) * usdAvgCost); // valor del gasto en pesos al promedio

  const closeModal = () => { setShowModal(false); setForm(INITIAL_FORM); setPayChequeIds([]); };

  const handleSave = () => {
    if (!form.description.trim()) { notify('Poné una descripción del movimiento.', 'error'); return; }
    const isEgreso = form.type === 'egreso';
    const payee = form.payee.trim();

    // ── Egreso pagado con DÓLARES ────────────────────────────────────────────
    if (isEgreso && form.method === 'dolares') {
      if (!form.usdAmount || form.usdAmount <= 0) { notify('Poné cuántos dólares usaste.', 'error'); return; }
      if (form.usdAmount > usdHoldings + 0.0001) { notify(`No te alcanza: solo tenés ${fmtUSD(usdHoldings)} en tenencia.`, 'error'); return; }
      if (usdAvgCost <= 0) { notify('No tenés dólares cargados para pagar con dólares.', 'error'); return; }
      addExpenseWithPayment(
        {
          type: 'egreso', category: form.category, amount: usdExpensePesos,
          description: form.description, date: form.date, paid: true,
          paymentMethod: 'dolares', payee, usdAmount: form.usdAmount, usdRate: usdAvgCost,
          vehicleId: undefined, clientId: undefined, supplierId: undefined,
        },
        { usd: { amountUsd: form.usdAmount, rate: usdAvgCost } },
      );
      closeModal();
      return;
    }

    // ── Egreso pagado con CHEQUE de cartera ──────────────────────────────────
    if (isEgreso && form.method === 'cheque') {
      if (!form.amount || form.amount <= 0) { notify('El monto tiene que ser mayor a 0.', 'error'); return; }
      if (!payChequeIds.length) { notify('Elegí al menos un cheque de la cartera.', 'error'); return; }
      addExpenseWithPayment(
        {
          type: 'egreso', category: form.category, amount: form.amount,
          description: form.description, date: form.date, paid: true,
          paymentMethod: 'cheque', payee,
          vehicleId: undefined, clientId: undefined, supplierId: undefined,
        },
        { payChequeIds, entregadoA: payee || form.description },
      );
      closeModal();
      return;
    }

    // ── Ingreso o egreso en EFECTIVO ─────────────────────────────────────────
    if (!form.amount || form.amount <= 0) { notify('El monto tiene que ser mayor a 0.', 'error'); return; }
    addTransaction({
      type: form.type,
      category: form.category,
      amount: form.amount,
      description: form.description,
      date: form.date,
      paid: isEgreso ? form.paid : true,
      paymentMethod: isEgreso ? 'efectivo' : undefined,
      payee: isEgreso ? payee : undefined,
      vehicleId: undefined,
      clientId: undefined,
      supplierId: undefined,
    });
    closeModal();
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Finanzas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Flujo de caja y movimientos</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nuevo movimiento
        </Button>
      </div>

      {/* Disponibilidad (total, no depende del mes) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Disponible en pesos */}
        <Card className={disponible >= 0 ? 'bg-brand-50' : 'bg-red-50'}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${disponible >= 0 ? 'bg-brand-100' : 'bg-red-100'}`}>
              <Wallet size={22} className={disponible >= 0 ? 'text-brand-600' : 'text-red-600'} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Disponible en pesos</p>
              <p className={`text-2xl font-bold ${disponible >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(disponible)}</p>
              <p className="text-[11px] text-slate-400">
                Efectivo + banco{chequesACobrar > 0 ? <> · incluye <b>{formatCurrency(chequesACobrar)}</b> en {chequesACobrarCount} cheque{chequesACobrarCount !== 1 ? 's' : ''} a cobrar</> : ''}
              </p>
            </div>
          </div>
        </Card>
        {/* Disponible en dólares */}
        <Card className="bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <DollarSign size={22} className="text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Disponible en dólares</p>
              <p className="text-2xl font-bold text-emerald-700">{fmtUSD(usdHoldings)}</p>
              <p className="text-[11px] text-slate-400">{usdPool > 0 ? <>≈ {formatCurrency(usdPool)} · promedio {formatCurrency(usdHoldings > 0 ? usdPool / usdHoldings : 0)}/US$</> : 'Cargá compras en Dólares'}</p>
            </div>
          </div>
        </Card>
        {/* Capital (inventario) */}
        <Card className="bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl">
              <Car size={22} className="text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Capital (autos en stock)</p>
              <p className="text-2xl font-bold text-amber-700">{formatCurrency(capital)}</p>
              <p className="text-[11px] text-slate-400">Costo de tus autos en stock. No es gasto: es tu capital invertido.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Month selector */}
      <div className="flex gap-3 items-center flex-wrap">
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
        >
          <option value="">Todos los meses</option>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {monthFilter && (
          <span className="text-sm text-slate-500">
            Mostrando: <span className="font-medium">{formatMonthLabel(monthFilter)}</span>
          </span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-green-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <TrendingUp size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Ingresos</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(monthIncome)}</p>
              <p className="text-[11px] text-slate-400">ganancia de ventas + ingresos de finanzas</p>
            </div>
          </div>
        </Card>
        <Card className="bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <TrendingDown size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Egresos</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(monthExpense)}</p>
              <p className="text-[11px] text-slate-400">
                gastos e impuestos (comprar autos no es gasto)
                {pendingExpense > 0 && <span className="text-amber-600 font-medium"> · {formatCurrency(pendingExpense)} pendiente</span>}
              </p>
            </div>
          </div>
        </Card>
        <Card className={monthUtilidad >= 0 ? 'bg-blue-50' : 'bg-red-50'}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${monthUtilidad >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
              <DollarSign size={20} className={monthUtilidad >= 0 ? 'text-brand-600' : 'text-red-600'} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Utilidad neta</p>
              <p className={`text-xl font-bold ${monthUtilidad >= 0 ? 'text-brand-600' : 'text-red-700'}`}>{formatCurrency(monthUtilidad)}</p>
              <p className="text-[11px] text-slate-400">igual que Reportes</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <h3 className="text-base font-semibold text-slate-900 mb-4">Ingresos vs Egresos (últimos 6 meses, en miles)</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}K`} />
              <Tooltip
                formatter={(v: number) => [`$${v.toLocaleString('es-AR')}K`]}
                contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '13px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Transaction list */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-slate-900">Movimientos</h3>
          {pendingCount > 0 && (
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
              Ver solo egresos pendientes ({pendingCount})
            </label>
          )}
        </div>
        {filtered.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filtered.map((m) => {
              const isPendingExpense = m.type === 'egreso' && !m.paid;
              const isAuto = m.source !== 'tx';
              return (
                <div key={m.key} className={`flex items-center gap-4 px-6 py-3 hover:bg-slate-50 ${isPendingExpense ? 'border-l-2 border-amber-400' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    m.type === 'ingreso' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {m.source === 'venta' || m.source === 'costo'
                      ? <Car size={14} className={m.type === 'ingreso' ? 'text-green-600' : 'text-red-600'} />
                      : m.type === 'ingreso'
                        ? <TrendingUp size={14} className="text-green-600" />
                        : <TrendingDown size={14} className="text-red-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                      <span className="truncate">{m.description}</span>
                      {isAuto && (
                        <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">{sourceTag[m.source]}</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(m.date)}
                      {m.method === 'cheque' && <span className="text-slate-500"> · con cheque</span>}
                      {m.method === 'dolares' && <span className="text-emerald-600"> · en dólares</span>}
                      {m.payee && <span className="text-slate-500"> · a {m.payee}</span>}
                      {m.type === 'egreso' && (
                        m.paid
                          ? <span className="text-green-600"> · Pagado{m.paidDate ? ` el ${formatDate(m.paidDate)}` : ''}</span>
                          : <span className="text-amber-600 font-medium"> · Pendiente</span>
                      )}
                    </p>
                  </div>

                  {/* Acción de pago solo para egresos manuales de Finanzas */}
                  {m.type === 'egreso' && m.source === 'tx' && (
                    m.paid
                      ? (
                        <button
                          onClick={() => markTransactionPaid(m.txId!, false)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-amber-600 transition-colors flex-shrink-0"
                          title="Marcar como pendiente"
                        >
                          <CheckCircle size={15} /> Pagado
                        </button>
                      )
                      : (
                        <Button size="sm" variant="secondary" onClick={() => markTransactionPaid(m.txId!, true)}>
                          <Clock size={13} /> Pagar
                        </Button>
                      )
                  )}

                  <span className={`text-sm font-bold flex-shrink-0 ${m.type === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                    {m.type === 'ingreso' ? '+' : '-'}{formatCurrency(m.amount)}
                  </span>

                  {m.source === 'tx' ? (
                    <button onClick={() => confirmDialog({ title: 'Eliminar movimiento', message: `¿Eliminar "${m.description}"?${m.method === 'cheque' ? ' El cheque vuelve a la cartera.' : m.method === 'dolares' ? ' Los dólares vuelven a tu tenencia.' : ''}`, confirmLabel: 'Eliminar', danger: true }).then((ok) => ok && deleteExpenseTransaction(m.txId!))} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  ) : m.vehicleId ? (
                    <button
                      onClick={() => navigate(`/vehiculos/${m.vehicleId}`)}
                      className="text-slate-300 hover:text-brand-600 transition-colors flex-shrink-0"
                      title="Ver vehículo"
                    >
                      <Car size={14} />
                    </button>
                  ) : (
                    <span className="w-3.5 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-6 py-8 text-center text-slate-400 text-sm">
            {onlyPending ? 'No hay egresos pendientes en este período' : 'Sin movimientos para este período'}
          </p>
        )}
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Nuevo movimiento"
        footer={
          <>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['ingreso', 'egreso'] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setForm((f) => ({ ...f, type: t, category: t === 'ingreso' ? 'venta_contado' : 'compra_vehiculo', paid: t === 'ingreso', method: 'efectivo', usdAmount: 0 })); setPayChequeIds([]); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 ${
                  form.type === t
                    ? t === 'ingreso' ? 'bg-green-50 border-green-400 text-green-800' : 'bg-red-50 border-red-400 text-red-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {t === 'ingreso' ? 'Ingreso' : 'Egreso'}
              </button>
            ))}
          </div>
          <Select
            label="Categoría" value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            options={categories}
          />
          <Input
            label="Descripción" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ej: Venta Toyota Corolla"
          />
          {/* Medio de pago (solo egresos) */}
          {form.type === 'egreso' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Medio de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((pm) => (
                  <button
                    key={pm.value}
                    onClick={() => { setForm((f) => ({ ...f, method: pm.value })); if (pm.value !== 'cheque') setPayChequeIds([]); }}
                    className={`py-2 rounded-xl text-xs font-medium transition-colors border-2 ${
                      form.method === pm.value ? 'bg-brand-50 border-brand-400 text-brand-800' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Monto (efectivo/cheque) o Dólares usados */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {form.type === 'egreso' && form.method === 'dolares' ? (
              <div>
                <Input
                  label="Dólares usados (U$S)" type="number" value={form.usdAmount}
                  onChange={(e) => setForm((f) => ({ ...f, usdAmount: +e.target.value }))}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  = <b>{formatCurrency(usdExpensePesos)}</b> al promedio ({fmtUSD(usdHoldings)} disponibles)
                </p>
              </div>
            ) : (
              <Input
                label="Monto ($)" type="number" value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: +e.target.value }))}
              />
            )}
            <Input
              label="Fecha" type="date" value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>

          {/* A quién le pagué (opcional) */}
          {form.type === 'egreso' && (
            <Input
              label="A quién le pagué (opcional)" value={form.payee}
              onChange={(e) => setForm((f) => ({ ...f, payee: e.target.value }))}
              placeholder="Ej: Taller Pérez, Juan, AFIP…"
            />
          )}

          {/* Cheques de cartera a entregar */}
          {form.type === 'egreso' && form.method === 'cheque' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Cheques de cartera a entregar</label>
              {carteraCheques.length === 0 ? (
                <p className="text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg px-3 py-4 text-center">
                  No tenés cheques en cartera. Cargalos en el apartado Cheques.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {carteraCheques.map((c) => {
                    const checked = payChequeIds.includes(c.id);
                    return (
                      <label key={c.id} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border cursor-pointer ${checked ? 'border-brand-400 bg-brand-50' : 'border-slate-200'}`}>
                        <input
                          type="checkbox" checked={checked}
                          onChange={(e) => setPayChequeIds((ids) => e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id))}
                        />
                        <span className="flex-1 min-w-0 truncate">{c.banco || 'Cheque'} N°{c.numero || '—'} · {c.librador || c.recibidoDe || 's/librador'}</span>
                        <span className="font-semibold flex-shrink-0">{formatCurrency(c.monto)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              {payChequeIds.length > 0 && (
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Entregás {payChequeIds.length} cheque{payChequeIds.length !== 1 ? 's' : ''} por <b>{formatCurrency(carteraCheques.filter((c) => payChequeIds.includes(c.id)).reduce((a, c) => a + c.monto, 0))}</b>
                  {form.amount > 0 && <> · gasto: {formatCurrency(form.amount)}</>}
                </p>
              )}
            </div>
          )}

          {form.type === 'egreso' && form.method === 'efectivo' && (
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.paid}
                onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
              />
              Ya está pagado
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
