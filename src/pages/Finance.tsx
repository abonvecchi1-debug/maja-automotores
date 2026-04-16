import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, DollarSign, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Input';
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
};

const categoryLabel: Record<string, string> = {
  venta_contado: 'Venta contado',
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

export function Finance() {
  const { transactions, vehicles, clients, addTransaction, deleteTransaction } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [monthFilter, setMonthFilter] = useState(getCurrentMonth());

  // Generate last 12 months for selector
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = d.toISOString().slice(0, 7);
    return { value: val, label: formatMonthLabel(val) };
  });

  const filtered = transactions
    .filter((t) => !monthFilter || t.date.startsWith(monthFilter))
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthIncome = filtered.filter((t) => t.type === 'ingreso').reduce((a, t) => a + t.amount, 0);
  const monthExpense = filtered.filter((t) => t.type === 'egreso').reduce((a, t) => a + t.amount, 0);
  const monthBalance = monthIncome - monthExpense;

  // Also include vehicle expenses and sales in the totals display
  const monthVehicleSales = vehicles
    .filter((v) => v.status === 'vendido' && v.soldDate?.startsWith(monthFilter))
    .reduce((a, v) => a + (v.soldPrice ?? 0), 0);

  // Chart data
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('es-AR', { month: 'short' });
    const ingresos = transactions.filter((t) => t.type === 'ingreso' && t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
    const egresos = transactions.filter((t) => t.type === 'egreso' && t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
    return { mes: label, Ingresos: Math.round(ingresos / 1000), Egresos: Math.round(egresos / 1000) };
  });

  const categories = form.type === 'ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSave = () => {
    if (!form.description || !form.amount) return;
    addTransaction({ ...form, vehicleId: undefined, clientId: undefined, supplierId: undefined });
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
      <div className="flex gap-3 items-center">
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
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-green-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl">
              <TrendingUp size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Ingresos</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(monthIncome)}</p>
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
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Movimientos</h3>
        </div>
        {filtered.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filtered.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  t.type === 'ingreso' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {t.type === 'ingreso'
                    ? <TrendingUp size={14} className="text-green-600" />
                    : <TrendingDown size={14} className="text-red-600" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{t.description}</p>
                  <p className="text-xs text-slate-500">
                    {categoryLabel[t.category] ?? t.category} · {formatDate(t.date)}
                  </p>
                </div>
                <span className={`text-sm font-bold ${t.type === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                  {t.type === 'ingreso' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
                <button onClick={() => deleteTransaction(t.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-8 text-center text-slate-400 text-sm">Sin movimientos para este período</p>
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
                onClick={() => setForm((f) => ({ ...f, type: t, category: t === 'ingreso' ? 'venta_contado' : 'compra_vehiculo' }))}
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
        </div>
      </Modal>
    </div>
  );
}
