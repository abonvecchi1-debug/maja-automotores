import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2, Car, CheckCircle, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
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

/** Movimiento unificado: transacción manual de Finanzas o venta de vehículo (derivada). */
type Movement = {
  key: string;
  source: 'tx' | 'venta';
  type: 'ingreso' | 'egreso';
  category: string;
  description: string;
  amount: number;
  date: string;
  paid: boolean;
  paidDate?: string;
  txId?: string;        // id de la transacción manual (para pagar / eliminar)
  vehicleId?: string;   // id del vehículo (para ventas derivadas)
};

export function Finance() {
  const { transactions, vehicles, addTransaction, deleteTransaction, markTransactionPaid } = useStore();
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

  // ── Movimientos: transacciones manuales + ventas de vehículos (derivadas) ──
  const txMovements: Movement[] = transactions.map((t) => ({
    key: `tx-${t.id}`,
    source: 'tx',
    type: t.type,
    category: t.category,
    description: t.description,
    amount: t.amount,
    date: t.date,
    paid: t.type === 'ingreso' ? true : (t.paid ?? true),
    paidDate: t.paidDate,
    txId: t.id,
  }));

  // Cada vehículo vendido se refleja automáticamente como ingreso (igual que en
  // Dashboard y Reportes). No se crea una transacción, así que no hay doble conteo.
  const saleMovements: Movement[] = vehicles
    .filter((v) => v.status === 'vendido' && v.soldDate)
    .map((v) => ({
      key: `venta-${v.id}`,
      source: 'venta',
      type: 'ingreso',
      category: 'venta_vehiculo',
      description: `Venta ${v.brand} ${v.model}${v.year ? ' ' + v.year : ''}`.trim(),
      amount: v.soldPrice ?? 0,
      date: v.soldDate!,
      paid: true,
      vehicleId: v.id,
    }));

  const allMovements = [...txMovements, ...saleMovements];

  const filtered = allMovements
    .filter((m) => !monthFilter || m.date.startsWith(monthFilter))
    .filter((m) => !onlyPending || (m.type === 'egreso' && !m.paid))
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthMovements = allMovements.filter((m) => !monthFilter || m.date.startsWith(monthFilter));
  const monthIncome = monthMovements.filter((m) => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0);
  // Solo los egresos ya pagados descuentan del balance. Los pendientes se muestran aparte.
  const paidExpense = monthMovements.filter((m) => m.type === 'egreso' && m.paid).reduce((a, m) => a + m.amount, 0);
  const pendingExpense = monthMovements.filter((m) => m.type === 'egreso' && !m.paid).reduce((a, m) => a + m.amount, 0);
  const monthBalance = monthIncome - paidExpense;
  const pendingCount = monthMovements.filter((m) => m.type === 'egreso' && !m.paid).length;

  // Chart data (incluye ventas de vehículos en los ingresos)
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('es-AR', { month: 'short' });
    const ingresosTx = transactions.filter((t) => t.type === 'ingreso' && t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
    const ingresosVentas = vehicles
      .filter((v) => v.status === 'vendido' && v.soldDate?.startsWith(m))
      .reduce((a, v) => a + (v.soldPrice ?? 0), 0);
    const egresos = transactions.filter((t) => t.type === 'egreso' && t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
    return { mes: label, Ingresos: Math.round((ingresosTx + ingresosVentas) / 1000), Egresos: Math.round(egresos / 1000) };
  });

  const categories = form.type === 'ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSave = () => {
    if (!form.description || !form.amount) return;
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
              <p className="text-[11px] text-slate-400">incluye ventas de vehículos</p>
            </div>
          </div>
        </Card>
        <Card className="bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <TrendingDown size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Egresos pagados</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(paidExpense)}</p>
              <p className="text-[11px] text-slate-400">
                {pendingExpense > 0
                  ? <span className="text-amber-600 font-medium">+ {formatCurrency(pendingExpense)} pendiente (no descontado)</span>
                  : 'todo pagado'}
              </p>
            </div>
          </div>
        </Card>
        <Card className={monthBalance >= 0 ? 'bg-blue-50' : 'bg-red-50'}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${monthBalance >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
              <DollarSign size={20} className={monthBalance >= 0 ? 'text-brand-600' : 'text-red-600'} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Balance neto</p>
              <p className={`text-xl font-bold ${monthBalance >= 0 ? 'text-brand-600' : 'text-red-700'}`}>{formatCurrency(monthBalance)}</p>
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
              return (
                <div key={m.key} className={`flex items-center gap-4 px-6 py-3 hover:bg-slate-50 ${isPendingExpense ? 'border-l-2 border-amber-400' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    m.type === 'ingreso' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {m.source === 'venta'
                      ? <Car size={14} className="text-green-600" />
                      : m.type === 'ingreso'
                        ? <TrendingUp size={14} className="text-green-600" />
                        : <TrendingDown size={14} className="text-red-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 flex items-center gap-2">
                      {m.description}
                      {m.source === 'venta' && (
                        <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Automático</span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      {categoryLabel[m.category] ?? m.category} · {formatDate(m.date)}
                      {m.type === 'egreso' && (
                        m.paid
                          ? <span className="text-green-600"> · Pagado{m.paidDate ? ` el ${formatDate(m.paidDate)}` : ''}</span>
                          : <span className="text-amber-600 font-medium"> · Pendiente de pago</span>
                      )}
                    </p>
                  </div>

                  {/* Estado / acción de pago para egresos manuales */}
                  {m.type === 'egreso' && m.source === 'tx' && (
                    m.paid
                      ? (
                        <button
                          onClick={() => markTransactionPaid(m.txId!, false)}
                          className="flex items-center gap-1 text-xs text-green-600 hover:text-amber-600 transition-colors"
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

                  <span className={`text-sm font-bold ${m.type === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                    {m.type === 'ingreso' ? '+' : '-'}{formatCurrency(m.amount)}
                  </span>

                  {m.source === 'venta' ? (
                    <button
                      onClick={() => navigate(`/vehiculos/${m.vehicleId}`)}
                      className="text-slate-300 hover:text-brand-600 transition-colors"
                      title="Ver vehículo"
                    >
                      <Car size={14} />
                    </button>
                  ) : (
                    <button onClick={() => deleteTransaction(m.txId!)} className="text-slate-300 hover:text-red-500 transition-colors" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
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
