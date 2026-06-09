import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, CheckCircle, Clock, Trash2, Plus } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { formatCurrency, formatDate, supplierTypeLabel, supplierTypeColor, vehicleLabel, statusLabel, statusColor } from '../utils/formatters';

const PURCHASE_CATEGORIES = [
  { value: 'repuestos', label: 'Repuestos' },
  { value: 'mecanica', label: 'Mecánica' },
  { value: 'lavado', label: 'Lavado' },
  { value: 'pintura', label: 'Pintura' },
  { value: 'documentacion', label: 'Documentación / Gestoría' },
  { value: 'otro', label: 'Otro' },
];

export function SupplierDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { suppliers, expenses, vehicles, addExpense, deleteSupplier, markExpensePaid, deleteExpense } = useStore();

  const supplier = suppliers.find((s) => s.id === id);
  const works = expenses.filter((e) => e.supplierId === id).sort((a, b) => b.date.localeCompare(a.date));
  const purchasedVehicles = vehicles.filter((v) => v.purchaseSupplierId === id);

  const [showModal, setShowModal] = useState(false);
  const emptyForm = {
    description: '', amount: 0, date: new Date().toISOString().split('T')[0],
    category: 'repuestos', vehicleId: '', paid: false, notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const handleSavePurchase = () => {
    if (!form.description || !form.amount) return;
    addExpense({
      description: form.description,
      amount: form.amount,
      date: form.date,
      category: form.category,
      supplierId: id!,
      vehicleId: form.vehicleId || undefined,
      paid: form.paid,
      paidDate: form.paid ? form.date : undefined,
      notes: form.notes,
    });
    setShowModal(false);
    setForm(emptyForm);
  };

  if (!supplier) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Proveedor no encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/proveedores')} className="mt-4">
          <ArrowLeft size={16} /> Volver
        </Button>
      </div>
    );
  }

  const totalDebt = works.filter((w) => !w.paid).reduce((a, w) => a + w.amount, 0);
  const totalPaid = works.filter((w) => w.paid).reduce((a, w) => a + w.amount, 0);
  const totalBilled = works.reduce((a, w) => a + w.amount, 0);

  const handleDelete = () => {
    if (confirm(`¿Eliminar proveedor "${supplier.name}"?`)) {
      deleteSupplier(id!);
      navigate('/proveedores');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/proveedores')} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{supplier.name}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${supplierTypeColor[supplier.type]}`}>
                {supplierTypeLabel[supplier.type]}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">{works.length} trabajos registrados</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setForm(emptyForm); setShowModal(true); }}>
            <Plus size={16} /> Registrar compra
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-red-50">
          <p className="text-xs text-slate-500 font-medium">Deuda actual</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 ${totalDebt > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {totalDebt > 0 ? formatCurrency(totalDebt) : 'Al día'}
          </p>
          <p className="text-xs text-slate-400 mt-1">{works.filter((w) => !w.paid).length} trabajos sin pagar</p>
        </Card>
        <Card className="bg-green-50">
          <p className="text-xs text-slate-500 font-medium">Total pagado</p>
          <p className="text-xl sm:text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-xs text-slate-500 font-medium">Total facturado</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalBilled)}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Works list */}
        <div className="xl:col-span-2">
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Historial de compras y trabajos</h3>
            </div>
            {works.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {works.map((w) => {
                  const veh = w.vehicleId ? vehicles.find((v) => v.id === w.vehicleId) : null;
                  return (
                    <div key={w.id} className={`flex items-center gap-4 px-6 py-4 hover:bg-slate-50 ${!w.paid ? 'border-l-2 border-amber-400' : ''}`}>
                      <div className="flex-shrink-0">
                        {w.paid
                          ? <CheckCircle size={18} className="text-green-500" />
                          : <Clock size={18} className="text-amber-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{w.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {veh && (
                            <button
                              onClick={() => navigate(`/vehiculos/${veh.id}`)}
                              className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                            >
                              <Car size={11} /> {vehicleLabel(veh.brand, veh.model, veh.year)}
                            </button>
                          )}
                          <span className="text-xs text-slate-400">{formatDate(w.date)}</span>
                          {w.paid && w.paidDate && <span className="text-xs text-green-600">· Pagado {formatDate(w.paidDate)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-bold text-slate-900">{formatCurrency(w.amount)}</span>
                        {w.paid
                          ? <Badge variant="success">Pagado</Badge>
                          : (
                            <Button size="sm" variant="secondary" onClick={() => markExpensePaid(w.id)}>
                              Pagar
                            </Button>
                          )
                        }
                        <button onClick={() => deleteExpense(w.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-8 text-center">
                <p className="text-slate-400 text-sm">Sin compras registradas todavía.</p>
                <Button variant="outline" className="mt-3" onClick={() => { setForm(emptyForm); setShowModal(true); }}>
                  <Plus size={14} /> Registrar primera compra
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Supplier info */}
        <div>
          <Card>
            <p className="text-base font-semibold text-slate-900 mb-3">Información</p>
            <dl className="space-y-2.5 text-sm">
              {[
                ['Tipo', supplierTypeLabel[supplier.type]],
                ['Teléfono', supplier.phone || '—'],
                ['Email', supplier.email || '—'],
                ['Dirección', supplier.address || '—'],
                ['CUIT', supplier.cuit || '—'],
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">{k}</dt>
                  <dd className="text-slate-900 mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
            {supplier.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Notas</p>
                <p className="text-sm text-slate-700 mt-1">{supplier.notes}</p>
              </div>
            )}
          </Card>

          {/* Autos comprados a este proveedor / agencia */}
          {purchasedVehicles.length > 0 && (
            <Card className="mt-4" padding={false}>
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-900">Autos comprados acá ({purchasedVehicles.length})</p>
              </div>
              <div className="divide-y divide-slate-100">
                {purchasedVehicles.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => navigate(`/vehiculos/${v.id}`)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 text-left transition-colors"
                  >
                    <Car size={15} className="text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{vehicleLabel(v.brand, v.model, v.year)}</p>
                      <p className="text-xs text-slate-500">{v.patent} · {formatCurrency(v.purchasePrice)}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[v.status]}`}>{statusLabel[v.status]}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Unpaid works summary */}
          {works.filter((w) => !w.paid).length > 0 && (
            <Card className="mt-4 bg-amber-50 border-amber-200">
              <p className="text-sm font-semibold text-amber-900 mb-3">Trabajos sin pagar</p>
              <div className="space-y-2">
                {works.filter((w) => !w.paid).map((w) => (
                  <div key={w.id} className="flex justify-between text-sm">
                    <span className="text-amber-800 truncate flex-1">{w.description}</span>
                    <span className="font-semibold text-amber-900 ml-2">{formatCurrency(w.amount)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-amber-200 flex justify-between text-sm font-bold">
                  <span className="text-amber-900">Total</span>
                  <span className="text-amber-900">{formatCurrency(totalDebt)}</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Registrar compra modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setForm(emptyForm); }}
        title={`Registrar compra · ${supplier.name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setForm(emptyForm); }}>Cancelar</Button>
            <Button onClick={handleSavePurchase}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="¿Qué le compraste / qué trabajo hizo?"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ej: Juego de pastillas de freno / Service completo"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Monto ($)" type="number" value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: +e.target.value }))} />
            <Input label="Fecha" type="date" value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <Select
            label="Categoría" value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            options={PURCHASE_CATEGORIES}
          />
          <Select
            label="Vehículo asociado (opcional)"
            value={form.vehicleId}
            onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
            options={vehicles.map((v) => ({ value: v.id, label: `${vehicleLabel(v.brand, v.model, v.year)} — ${v.patent}` }))}
            placeholder="Sin vehículo asociado"
          />
          <Textarea label="Notas (opcional)" value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Observaciones..." />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={form.paid}
              onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))} />
            Ya está pagado
          </label>
          <p className="text-[11px] text-slate-400">
            Si lo dejás sin pagar, se suma a la deuda con el proveedor. Después podés tocar "Pagar" cuando lo saldes.
          </p>
        </div>
      </Modal>
    </div>
  );
}
