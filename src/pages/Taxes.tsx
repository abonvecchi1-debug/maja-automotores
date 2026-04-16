import { useState } from 'react';
import { Plus, CheckCircle, Clock, Trash2, AlertCircle, FileText } from 'lucide-react';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatDate, getCurrentMonth, formatMonthLabel } from '../utils/formatters';
import type { TaxType } from '../types';

const TAX_TYPES: { value: TaxType; label: string }[] = [
  { value: 'iibb',                label: 'Ingresos Brutos (IIBB)' },
  { value: 'monotributo',         label: 'Monotributo' },
  { value: 'responsable_inscripto', label: 'IVA / Responsable Inscripto' },
  { value: 'autonomos',           label: 'Autónomos' },
  { value: 'ganancias',           label: 'Ganancias' },
  { value: 'otro',                label: 'Otro' },
];

const TAX_COLORS: Record<TaxType, string> = {
  iibb: 'bg-amber-100 text-amber-800',
  monotributo: 'bg-blue-100 text-blue-800',
  responsable_inscripto: 'bg-purple-100 text-purple-800',
  autonomos: 'bg-green-100 text-green-800',
  ganancias: 'bg-red-100 text-red-800',
  otro: 'bg-slate-100 text-slate-700',
};

const INITIAL_FORM = {
  type: 'iibb' as TaxType,
  description: '',
  month: getCurrentMonth(),
  amount: 0,
  dueDate: '',
  paid: false,
  notes: '',
};

export function Taxes() {
  const { taxPayments, addTaxPayment, updateTaxPayment, deleteTaxPayment, markTaxPaid } = useStore();

  const [monthFilter, setMonthFilter] = useState(getCurrentMonth());
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = d.toISOString().slice(0, 7);
    return { value: val, label: formatMonthLabel(val) };
  });

  const monthPayments = taxPayments.filter((t) => t.month === monthFilter);
  const totalMonth = monthPayments.reduce((a, t) => a + t.amount, 0);
  const paidMonth = monthPayments.filter((t) => t.paid).reduce((a, t) => a + t.amount, 0);
  const pendingMonth = totalMonth - paidMonth;

  const today = new Date().toISOString().split('T')[0];
  const overdue = taxPayments.filter((t) => !t.paid && t.dueDate < today);

  const openNew = () => {
    setEditId(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    const t = taxPayments.find((p) => p.id === id);
    if (!t) return;
    setEditId(id);
    setForm({
      type: t.type,
      description: t.description,
      month: t.month,
      amount: t.amount,
      dueDate: t.dueDate,
      paid: t.paid,
      notes: t.notes,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.description.trim()) { setFormError('La descripción es obligatoria.'); return; }
    if (!form.amount || form.amount <= 0) { setFormError('Ingresá un monto mayor a 0.'); return; }
    if (!form.dueDate) { setFormError('La fecha de vencimiento es obligatoria.'); return; }
    if (editId) {
      updateTaxPayment(editId, form);
    } else {
      addTaxPayment(form);
    }
    setShowModal(false);
    setFormError('');
  };

  const taxTypeLabel = (type: TaxType) => TAX_TYPES.find((t) => t.value === type)?.label ?? type;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Impuestos</h1>
          <p className="text-slate-500 text-sm mt-0.5">Registro de pagos impositivos mensuales</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Agregar pago impositivo
        </Button>
      </div>

      {/* Alerta vencidos */}
      {overdue.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-800">
            Tenés <span className="font-bold">{overdue.length} pago{overdue.length > 1 ? 's' : ''}</span> impositivo{overdue.length > 1 ? 's' : ''} vencido{overdue.length > 1 ? 's' : ''}{' '}
            sin registrar: {overdue.map((t) => t.description).join(', ')}.
          </p>
        </div>
      )}

      {/* Selector de mes */}
      <div className="flex items-center gap-3">
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
        >
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* Resumen del mes */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-50">
          <p className="text-xs text-slate-500 font-medium">Total del mes</p>
          <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalMonth)}</p>
        </Card>
        <Card className="bg-green-50">
          <p className="text-xs text-slate-500 font-medium">Pagado</p>
          <p className="text-xl sm:text-2xl font-bold text-green-700 mt-1">{formatCurrency(paidMonth)}</p>
        </Card>
        <Card className={pendingMonth > 0 ? 'bg-amber-50' : 'bg-green-50'}>
          <p className="text-xs text-slate-500 font-medium">Pendiente</p>
          <p className={`text-xl sm:text-2xl font-bold mt-1 ${pendingMonth > 0 ? 'text-amber-700' : 'text-green-700'}`}>
            {formatCurrency(pendingMonth)}
          </p>
        </Card>
      </div>

      {/* Lista de pagos del mes */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Pagos de {formatMonthLabel(monthFilter)}</h3>
        </div>
        {monthPayments.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {monthPayments
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
              .map((t) => {
                const isOverdue = !t.paid && t.dueDate < today;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-4 px-6 py-4 hover:bg-slate-50 ${isOverdue ? 'border-l-2 border-red-400' : ''}`}
                  >
                    <div className="flex-shrink-0">
                      {t.paid
                        ? <CheckCircle size={20} className="text-green-500" />
                        : <Clock size={20} className={isOverdue ? 'text-red-500' : 'text-amber-500'} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{t.description}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAX_COLORS[t.type]}`}>
                          {taxTypeLabel(t.type)}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                        {t.paid
                          ? `Pagado el ${formatDate(t.paidDate)}`
                          : `Vence el ${formatDate(t.dueDate)}${isOverdue ? ' — VENCIDO' : ''}`
                        }
                        {t.notes && ` · ${t.notes}`}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-slate-900 flex-shrink-0">{formatCurrency(t.amount)}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!t.paid && (
                        <Button
                          size="sm"
                          variant={isOverdue ? 'danger' : 'secondary'}
                          onClick={() => markTaxPaid(t.id)}
                        >
                          Marcar pagado
                        </Button>
                      )}
                      {t.paid && <Badge variant="success">Pagado</Badge>}
                      <button
                        onClick={() => openEdit(t.id)}
                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        onClick={() => deleteTaxPayment(t.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <p className="text-slate-400 text-sm">Sin pagos registrados para este mes.</p>
            <p className="text-slate-400 text-xs mt-1">Agregá los pagos que te indica tu contador: IIBB, Monotributo, etc.</p>
            <Button variant="outline" className="mt-4" onClick={openNew}>
              <Plus size={14} /> Agregar pago
            </Button>
          </div>
        )}
      </Card>

      {/* Info box */}
      <Card className="bg-slate-50">
        <div className="flex items-start gap-3">
          <FileText size={18} className="text-slate-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-slate-900">¿Cómo usar este módulo?</p>
            <p className="text-sm text-slate-600 mt-1">
              Registrá acá los pagos impositivos que te indica tu contador cada mes: IIBB, Monotributo,
              IVA, Autónomos, Ganancias, etc. El monto real depende de tu régimen,
              saldo a favor y percepciones bancarias — solo tu contador puede darte el número exacto.
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Marcá cada pago como "Pagado" una vez que lo hayas efectuado para tener el registro al día.
            </p>
          </div>
        </div>
      </Card>

      {/* Modal agregar/editar */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setFormError(''); }}
        title={editId ? 'Editar pago impositivo' : 'Nuevo pago impositivo'}
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setFormError(''); }}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de impuesto</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TaxType }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
            >
              {TAX_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <Input
            label="Descripción"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ej: IIBB Mayo 2025, Monotributo Junio..."
            autoFocus
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mes</label>
              <select
                value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
              >
                {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <Input
              label="Fecha de vencimiento"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <Input
            label="Monto ($)"
            type="number"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: +e.target.value }))}
          />
          <Input
            label="Notas (opcional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Ej: Con saldo a favor de $X, retención bancaria incluida..."
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
            />
            Ya pagado
          </label>
        </div>
      </Modal>
    </div>
  );
}
