import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users, ChevronRight, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Input';
import { formatCurrency, formatDate } from '../utils/formatters';

const PROVINCES = ['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán']
  .map((p) => ({ value: p, label: p }));

const INITIAL_FORM = {
  firstName: '', lastName: '', dni: '', cuit: '', phone: '', email: '',
  address: '', city: '', province: 'Buenos Aires', notes: '',
};

export function Clients() {
  const navigate = useNavigate();
  const { clients, sales, installmentPayments, vehicles, addClient } = useStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const filtered = clients.filter((c) =>
    search === '' ||
    `${c.firstName} ${c.lastName} ${c.dni} ${c.phone}`.toLowerCase().includes(search.toLowerCase())
  );

  const clientBalance = (clientId: string) => {
    const clientSales = sales.filter((s) => s.clientId === clientId && s.paymentType === 'financiado');
    const pending = clientSales.flatMap((s) =>
      installmentPayments.filter((p) => p.saleId === s.id && !p.paid)
    );
    const overdue = pending.filter((p) => p.dueDate < today);
    return {
      pending: pending.reduce((a, p) => a + p.amount, 0),
      overdue: overdue.length,
    };
  };

  const clientPurchases = (clientId: string) => sales.filter((s) => s.clientId === clientId).length;

  const handleSave = () => {
    if (!form.firstName.trim()) { setFormError('El nombre es obligatorio.'); return; }
    if (!form.lastName.trim()) { setFormError('El apellido es obligatorio.'); return; }
    setFormError('');
    addClient(form);
    setShowModal(false);
    setForm(INITIAL_FORM);
  };

  const field = (key: keyof typeof INITIAL_FORM, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Clientes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{clients.length} clientes registrados</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nuevo cliente
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, DNI, teléfono..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
        />
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Contacto</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Compras</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const balance = clientBalance(c.id);
                const purchases = clientPurchases(c.id);
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/clientes/${c.id}`)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0 text-brand-600 font-bold text-sm">
                          {c.firstName[0]}{c.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-slate-500">DNI: {c.dni}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <p className="text-slate-700">{c.phone}</p>
                      <p className="text-xs text-slate-500">{c.city}, {c.province}</p>
                    </td>
                    <td className="px-4 py-4 text-center hidden md:table-cell">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-semibold text-sm">
                        {purchases}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      {balance.pending > 0 ? (
                        <div>
                          <p className={`font-semibold ${balance.overdue > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                            {formatCurrency(balance.pending)}
                          </p>
                          {balance.overdue > 0 && (
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <AlertTriangle size={11} className="text-red-500" />
                              <p className="text-xs text-red-600">{balance.overdue} cuota{balance.overdue > 1 ? 's' : ''} vencida{balance.overdue > 1 ? 's' : ''}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm">Al día</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <ChevronRight size={16} className="text-slate-400 ml-auto" />
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No se encontraron clientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setForm(INITIAL_FORM); setFormError(''); }}
        title="Nuevo cliente"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar cliente</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {formError && <p className="col-span-1 sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>}
          <Input label="Nombre" value={form.firstName} onChange={(e) => field('firstName', e.target.value)} placeholder="Juan Carlos" />
          <Input label="Apellido" value={form.lastName} onChange={(e) => field('lastName', e.target.value)} placeholder="Rodríguez" />
          <Input label="DNI" value={form.dni} onChange={(e) => field('dni', e.target.value)} placeholder="28.456.789" />
          <Input label="CUIT (opcional)" value={form.cuit} onChange={(e) => field('cuit', e.target.value)} placeholder="20-28456789-3" />
          <Input label="Teléfono" value={form.phone} onChange={(e) => field('phone', e.target.value)} placeholder="11-4567-8901" />
          <div className="col-span-1 sm:col-span-2">
            <Input label="Email" type="email" value={form.email} onChange={(e) => field('email', e.target.value)} placeholder="cliente@email.com" />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <Input label="Dirección" value={form.address} onChange={(e) => field('address', e.target.value)} placeholder="Av. Corrientes 1234" />
          </div>
          <Input label="Ciudad" value={form.city} onChange={(e) => field('city', e.target.value)} placeholder="Buenos Aires" />
          <Select label="Provincia" value={form.province} onChange={(e) => field('province', e.target.value)} options={PROVINCES} />
          <div className="col-span-1 sm:col-span-2">
            <Textarea label="Notas" value={form.notes} onChange={(e) => field('notes', e.target.value)} placeholder="Observaciones del cliente..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
