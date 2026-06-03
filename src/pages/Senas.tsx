import { useState } from 'react';
import { Plus, Trash2, CheckCircle, XCircle, ArrowDownLeft, ArrowUpRight, HandCoins } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatDate, vehicleLabel } from '../utils/formatters';
import type { PaymentMethod, SenaType } from '../types';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credito_prendario', label: 'Crédito prendario' },
];
const methodLabel = (m: string) => METHODS.find((x) => x.value === m)?.label ?? m;

const INITIAL_FORM = {
  type: 'venta' as SenaType,
  vehicleId: '',
  clientId: '',
  counterpartyName: '',
  amount: 0,
  method: 'efectivo' as PaymentMethod,
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

export function Senas() {
  const { senas, vehicles, clients, addSena, updateSena, deleteSena } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'todas' | 'activa' | 'aplicada' | 'cancelada'>('activa');

  const activasVenta = senas.filter((s) => s.type === 'venta' && s.status === 'activa').reduce((a, s) => a + s.amount, 0);
  const activasCompra = senas.filter((s) => s.type === 'compra' && s.status === 'activa').reduce((a, s) => a + s.amount, 0);

  const filtered = senas
    .filter((s) => filter === 'todas' || s.status === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  const handleSave = () => {
    if (!form.amount) return;
    addSena({
      type: form.type,
      vehicleId: form.vehicleId || undefined,
      clientId: form.type === 'venta' ? (form.clientId || undefined) : undefined,
      counterpartyName: form.counterpartyName,
      amount: form.amount,
      method: form.method,
      date: form.date,
      status: 'activa',
      notes: form.notes,
    });
    setShowModal(false);
    setForm(INITIAL_FORM);
  };

  const partyName = (s: typeof senas[number]) => {
    if (s.clientId) {
      const c = clients.find((x) => x.id === s.clientId);
      if (c) return `${c.firstName} ${c.lastName}`;
    }
    return s.counterpartyName || '—';
  };

  const vehName = (s: typeof senas[number]) => {
    const v = vehicles.find((x) => x.id === s.vehicleId);
    return v ? vehicleLabel(v.brand, v.model, v.year) : null;
  };

  const stockVehicles = vehicles.filter((v) => v.status !== 'vendido');

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Señas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Reservas con depósito — de venta y de compra</p>
        </div>
        <Button onClick={() => { setForm(INITIAL_FORM); setShowModal(true); }}>
          <Plus size={16} /> Nueva seña
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-green-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-xl"><ArrowDownLeft size={20} className="text-green-600" /></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Señas de venta activas (a favor)</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(activasVenta)}</p>
            </div>
          </div>
        </Card>
        <Card className="bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl"><ArrowUpRight size={20} className="text-red-600" /></div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Señas de compra activas (entregadas)</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(activasCompra)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['activa', 'aplicada', 'cancelada', 'todas'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f === 'activa' ? 'Activas' : f === 'aplicada' ? 'Aplicadas' : f === 'cancelada' ? 'Canceladas' : 'Todas'}
          </button>
        ))}
      </div>

      {/* List */}
      <Card padding={false}>
        {filtered.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filtered.map((s) => {
              const v = vehName(s);
              return (
                <div key={s.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${s.type === 'venta' ? 'bg-green-100' : 'bg-red-100'}`}>
                    <HandCoins size={16} className={s.type === 'venta' ? 'text-green-600' : 'text-red-600'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {s.type === 'venta' ? 'Seña recibida' : 'Seña entregada'} · {partyName(s)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {v ? `${v} · ` : ''}{methodLabel(s.method)} · {formatDate(s.date)}
                      {s.notes ? ` · ${s.notes}` : ''}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${s.type === 'venta' ? 'text-green-700' : 'text-red-700'}`}>
                    {s.type === 'venta' ? '+' : '-'}{formatCurrency(s.amount)}
                  </span>
                  {s.status === 'activa' ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="secondary" onClick={() => updateSena(s.id, { status: 'aplicada' })} title="Marcar como completada">
                        <CheckCircle size={13} /> Completar
                      </Button>
                      <button onClick={() => updateSena(s.id, { status: 'cancelada' })} className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors" title="Cancelar seña">
                        <XCircle size={15} />
                      </button>
                    </div>
                  ) : (
                    <Badge variant={s.status === 'aplicada' ? 'success' : undefined} className={s.status === 'cancelada' ? 'bg-slate-100 text-slate-500' : ''}>
                      {s.status === 'aplicada' ? 'Completada' : 'Cancelada'}
                    </Badge>
                  )}
                  {deleteId === s.id ? (
                    <span className="flex items-center gap-1 text-xs">
                      <button onClick={() => { deleteSena(s.id); setDeleteId(null); }} className="px-2 py-1 rounded bg-red-500 text-white">Sí</button>
                      <button onClick={() => setDeleteId(null)} className="px-2 py-1 rounded bg-slate-100 text-slate-600">No</button>
                    </span>
                  ) : (
                    <button onClick={() => setDeleteId(s.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-6 py-8 text-center text-slate-400 text-sm">Sin señas {filter !== 'todas' ? `(${filter})` : ''}</p>
        )}
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setForm(INITIAL_FORM); }}
        title="Nueva seña"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar seña</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {([['venta', 'Cliente me seña'], ['compra', 'Yo seño un auto']] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 ${
                  form.type === t
                    ? t === 'venta' ? 'bg-green-50 border-green-400 text-green-800' : 'bg-red-50 border-red-400 text-red-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {form.type === 'venta' && (
            <>
              <Select
                label="Vehículo que reserva (opcional)"
                value={form.vehicleId}
                onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
                options={stockVehicles.map((v) => ({ value: v.id, label: `${vehicleLabel(v.brand, v.model, v.year)} — ${v.patent}` }))}
                placeholder="Sin vehículo asignado"
              />
              <Select
                label="Cliente (opcional)"
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                options={clients.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
                placeholder="Sin cliente en ficha"
              />
            </>
          )}

          <Input
            label={form.type === 'venta' ? 'Nombre del cliente (si no está en ficha)' : 'Vendedor / a quién le señás'}
            value={form.counterpartyName}
            onChange={(e) => setForm((f) => ({ ...f, counterpartyName: e.target.value }))}
            placeholder={form.type === 'venta' ? 'Ej: Juan Pérez' : 'Ej: Particular / agencia'}
          />

          {form.type === 'compra' && (
            <Input
              label="Vehículo que señás (descripción)"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Ej: VW Gol 2015 gris — patente AB123CD"
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Monto de la seña ($)" type="number" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: +e.target.value }))} />
            <Input label="Fecha" type="date" value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>

          <Select
            label="Medio de pago"
            value={form.method}
            onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}
            options={METHODS}
          />

          {form.type === 'venta' && (
            <Textarea label="Notas (opcional)" value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Observaciones de la reserva..." />
          )}
        </div>
      </Modal>
    </div>
  );
}
