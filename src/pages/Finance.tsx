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
};

const categoryLabel: Record<string, string> = {
  venta_contado: 'Venta contado',
  venta_vehiculo: 'Venta de vehículo',
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
type MovSource = 'venta' | 'costo' | 'tx' | 'gasto' | 'fijo' | 'impuesto';
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
};

const sourceTag: Record<MovSource, string> = {
  venta: 'Venta', costo: 'Costo auto', tx: 'Finanzas', gasto: 'Gasto', fijo: 'Gasto fijo', impuesto: 'Impuesto',
};

export function Finance() {
  const { transactions, vehicles, sales, installmentPayments, cheques, expenses, fixedExpenseRecords, taxPayments, addTransaction, deleteTransaction, markTransactionPaid } = useStore();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
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
    movements.push({
      key: `venta-${v.id}`, source: 'venta', type: 'ingreso', category: 'venta_vehiculo',
      description: `Venta ${v.brand} ${v.model}${v.year ? ' ' + v.year : ''}`.trim(),
      amount: v.soldPrice ?? 0, date: v.soldDate!, paid: true, vehicleId: v.id,
    });
    if ((v.purchasePrice ?? 0) > 0) {
      movements.push({
        key: `costo-${v.id}`, source: 'costo', type: 'egreso', category: 'costo_vehiculo',
        description: `Costo de compra · ${v.brand} ${v.model}`,
        amount: v.purchasePrice, date: v.soldDate!, paid: true, vehicleId: v.id,
      });
    }
  }
  // Transacciones manuales de Finanzas
  for (const t of transactions) {
    movements.push({
      key: `tx-${t.id}`, source: 'tx', type: t.type, category: t.category, description: t.description,
      amount: t.amount, date: t.date, paid: t.type === 'ingreso' ? true : (t.paid ?? true), paidDate: t.paidDate, txId: t.id,
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
  // Plata líquida que entró menos la que salió (de lo registrado). No descuenta la
  // compra del stock que no esté cargada como egreso. "En cheques" = cartera.
  const isLiquid = (m?: string) => !!m && LIQUID_METHODS.includes(m as never);

  let saleLiquid = 0;
  for (const v of vehicles.filter((v) => v.status === 'vendido')) {
    const sale = sales.find((s) => s.id === v.saleId) ?? sales.find((s) => s.vehicleId === v.id);
    if (sale?.paymentMethods?.length) {
      // El desglose ya excluye lo que no es plata (parte de pago, cheque).
      saleLiquid += sale.paymentMethods.filter((p) => isLiquid(p.method)).reduce((a, p) => a + p.amount, 0);
    } else if (sale) {
      // Sin desglose: el precio puede incluir un auto en parte de pago (no es plata) → descontarlo.
      saleLiquid += sale.paymentType === 'financiado'
        ? (sale.downPayment ?? 0)
        : Math.max(0, (sale.salePrice ?? v.soldPrice ?? 0) - (sale.tradeInValue ?? 0));
    } else {
      // Venta desde el vehículo (sin registro de venta): si recibimos un auto en parte de
      // pago, descontar su valor (es stock, no plata líquida).
      const tradeInVal = v.tradeInVehicleId
        ? (vehicles.find((x) => x.id === v.tradeInVehicleId)?.purchasePrice ?? 0)
        : 0;
      saleLiquid += Math.max(0, (v.soldPrice ?? 0) - tradeInVal);
    }
  }
  const collectedInstallments = installmentPayments.filter((p) => p.paid).reduce((a, p) => a + p.amount, 0);
  const manualIncome = transactions.filter((t) => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  // Señas ahora viven en el vehículo: venta activa (señado) suma; compra (mientras está señado) resta.
  const senaVentaActiva = vehicles
    .filter((v) => v.status === 'señado' && v.senaType === 'venta' && (v.senaAmount ?? 0) > 0 && isLiquid(v.senaMethod))
    .reduce((a, v) => a + (v.senaAmount ?? 0), 0);
  // Mientras la compra está señada solo salió la seña (el precio total se descuenta recién al completar la compra).
  const senaCompra = vehicles
    .filter((v) => v.status === 'señado' && v.senaType === 'compra' && (v.senaAmount ?? 0) > 0 && isLiquid(v.senaMethod))
    .reduce((a, v) => a + (v.senaAmount ?? 0), 0);
  // Compra de vehículos pagada en plata: descuenta el precio de compra. Excluye los recibidos
  // en parte de pago (no salió plata) y los que están señados como compra (solo salió la seña).
  const comprasVehiculos = vehicles
    .filter((v) => v.acquiredAs !== 'parte_pago' && !(v.status === 'señado' && v.senaType === 'compra'))
    .reduce((a, v) => a + (v.purchasePrice ?? 0), 0);
  const chequesCobrados = cheques.filter((c) => c.moneda === 'ARS' && c.estado === 'cobrado').reduce((a, c) => a + c.monto, 0);
  const manualPaidExpense = transactions.filter((t) => t.type === 'egreso' && t.paid !== false).reduce((a, t) => a + t.amount, 0);
  const gastosVarPaid = expenses.filter((e) => e.paid).reduce((a, e) => a + e.amount, 0);
  const gastosFijosPaid = fixedExpenseRecords.filter((r) => r.paid).reduce((a, r) => a + r.amount, 0);
  const impuestosPaid = taxPayments.filter((t) => t.paid).reduce((a, t) => a + t.amount, 0);

  const disponible = saleLiquid + collectedInstallments + manualIncome + senaVentaActiva + chequesCobrados
    - manualPaidExpense - gastosVarPaid - gastosFijosPaid - impuestosPaid - senaCompra - comprasVehiculos;

  const chequesEnCarteraEstados = ['en_cartera', 'depositado'];
  const enChequesARS = cheques.filter((c) => c.moneda === 'ARS' && chequesEnCarteraEstados.includes(c.estado)).reduce((a, c) => a + c.monto, 0);
  const enChequesUSD = cheques.filter((c) => c.moneda === 'USD' && chequesEnCarteraEstados.includes(c.estado)).reduce((a, c) => a + c.monto, 0);
  const enChequesCount = cheques.filter((c) => chequesEnCarteraEstados.includes(c.estado)).length;
  const fmtUSD = (n: number) => 'U$S ' + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });

  const handleSave = () => {
    if (!form.description.trim()) { notify('Poné una descripción del movimiento.', 'error'); return; }
    if (!form.amount || form.amount <= 0) { notify('El monto tiene que ser mayor a 0.', 'error'); return; }
    addTransaction({
      type: form.type,
      category: form.category,
      amount: form.amount,
      description: form.description,
      date: form.date,
      paid: form.type === 'egreso' ? form.paid : true,
      vehicleId: undefined,
      clientId: undefined,
      supplierId: undefined,
    });
    setShowModal(false);
    setForm(INITIAL_FORM);
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
        <Card className={`sm:col-span-2 ${disponible >= 0 ? 'bg-brand-50' : 'bg-red-50'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${disponible >= 0 ? 'bg-brand-100' : 'bg-red-100'}`}>
              <Wallet size={22} className={disponible >= 0 ? 'text-brand-600' : 'text-red-600'} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Disponible (efectivo + banco)</p>
              <p className={`text-2xl font-bold ${disponible >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(disponible)}</p>
              <p className="text-[11px] text-slate-400">Plata líquida: ingresos cobrados menos egresos pagados y compras de vehículos (precio de compra). Los autos recibidos en parte de pago no descuentan.</p>
            </div>
          </div>
        </Card>
        <Card className="bg-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-xl">
              <FileText size={22} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">En cheques (cartera)</p>
              <p className="text-2xl font-bold text-purple-700">{formatCurrency(enChequesARS)}</p>
              {enChequesUSD > 0 && <p className="text-xs font-semibold text-purple-600">+ {fmtUSD(enChequesUSD)}</p>}
              <p className="text-[11px] text-slate-400">{enChequesCount} cheque{enChequesCount !== 1 ? 's' : ''} · pasan a disponible al cobrarse</p>
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
              <p className="text-[11px] text-slate-400">ventas + ingresos de finanzas</p>
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
                gastos, impuestos y costo de autos vendidos
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
                    <button onClick={() => confirmDialog({ title: 'Eliminar movimiento', message: `¿Eliminar "${m.description}"?`, confirmLabel: 'Eliminar', danger: true }).then((ok) => ok && deleteTransaction(m.txId!))} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0" title="Eliminar">
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
        onClose={() => { setShowModal(false); setForm(INITIAL_FORM); }}
        title="Nuevo movimiento"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['ingreso', 'egreso'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm((f) => ({ ...f, type: t, category: t === 'ingreso' ? 'venta_contado' : 'compra_vehiculo', paid: t === 'ingreso' }))}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Monto ($)" type="number" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: +e.target.value }))}
            />
            <Input
              label="Fecha" type="date" value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          {form.type === 'egreso' && (
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
