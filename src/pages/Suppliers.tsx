import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, ChevronRight, Wrench } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Input';
import { formatCurrency, supplierTypeLabel, supplierTypeColor } from '../utils/formatters';
import type { SupplierType } from '../types';

const TYPE_OPTIONS: { value: SupplierType; label: string }[] = [
  { value: 'mecanico',    label: 'Mecánico' },
  { value: 'repuestero',  label: 'Repuestero' },
  { value: 'lavadero',    label: 'Lavadero' },
  { value: 'gestor',      label: 'Gestor' },
  { value: 'otro',        label: 'Otro' },
];

const INITIAL_FORM = {
  name: '', type: 'mecanico' as SupplierType,
  phone: '', email: '', address: '', cuit: '', notes: '',
};

export function Suppliers() {
  const navigate = useNavigate();
  const { suppliers, expenses, addSupplier } = useStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const filtered = suppliers.filter((s) => {
    const matchSearch = search === '' || s.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === '' || s.type === typeFilter;
    return matchSearch && matchType;
  });

  const supplierDebt = (supplierId: string) =>
    expenses.filter((e) => e.supplierId === supplierId && !e.paid).reduce((a, e) => a + e.amount, 0);

  const supplierTotal = (supplierId: string) =>
    expenses.filter((e) => e.supplierId === supplierId).reduce((a, e) => a + e.amount, 0);

  const workCount = (supplierId: string) =>
    expenses.filter((e) => e.supplierId === supplierId).length;

  const handleSave = () => {
    if (!form.name) return;
    addSupplier(form);
    setShowModal(false);
    setForm(INITIAL_FORM);
  };

  const totalDebt = suppliers.reduce((a, s) => a + supplierDebt(s.id), 0);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Proveedores</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {suppliers.length} proveedores · Deuda total: <span className="text-amber-600 font-semibold">{formatCurrency(totalDebt)}</span>
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nuevo proveedor
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
          />
        </div>
        <select
          value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600 text-slate-700"
        >
          <option value="">Todos los tipos</option>
          {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map((s) => {
          const debt = supplierDebt(s.id);
          const total = supplierTotal(s.id);
          const works = workCount(s.id);
          return (
            <div
              key={s.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md cursor-pointer transition-all hover:border-slate-300"
              onClick={() => navigate(`/proveedores/${s.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Wrench size={18} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{s.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${supplierTypeColor[s.type]}`}>
                      {supplierTypeLabel[s.type]}
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-400 flex-shrink-0 mt-1" />
              </div>

              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Trabajos</p>
                  <p className="text-lg font-bold text-slate-900">{works}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Total facturado</p>
                  <p className="text-sm font-bold text-slate-700">{formatCurrency(total)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Deuda actual</p>
                  <p className={`text-sm font-bold ${debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {debt > 0 ? formatCurrency(debt) : 'Al día'}
                  </p>
                </div>
              </div>

              {s.phone && (
                <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                  📞 {s.phone}
                  {s.cuit ? ` · CUIT: ${s.cuit}` : ''}
                </p>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-1 sm:col-span-2 text-center py-12 text-slate-400">
            No se encontraron proveedores
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setForm(INITIAL_FORM); }}
        title="Nuevo proveedor"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar proveedor</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-1 sm:col-span-2">
            <Input label="Nombre del proveedor" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej: Mecánica García" />
          </div>
          <Select
            label="Tipo"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SupplierType }))}
            options={TYPE_OPTIONS}
          />
          <Input label="Teléfono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="11-2233-4455" />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="proveedor@email.com" />
          <Input label="CUIT" value={form.cuit} onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))} placeholder="20-12345678-9" />
          <div className="col-span-1 sm:col-span-2">
            <Input label="Dirección" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Av. San Juan 1100, CABA" />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <Textarea label="Notas" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Condiciones, precios acordados, etc." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
