import { useState } from 'react';
import { Plus, Settings, CheckCircle, Clock, Trash2, RefreshCw, Pencil } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { confirmDialog } from '../components/ui/Feedback';
import { formatCurrency, formatDate, getCurrentMonth, formatMonthLabel } from '../utils/formatters';

const CATEGORIES = [
  { value: 'alquiler', label: 'Alquiler' },
  { value: 'servicios', label: 'Servicios (luz, agua, gas)' },
  { value: 'internet', label: 'Internet / Telefonía' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'sueldos', label: 'Sueldos / Personal' },
  { value: 'otro', label: 'Otro' },
];

const INITIAL_TYPE_FORM = { name: '', category: 'servicios', defaultAmount: 0, dueDay: 10, recurring: true, active: true };
const INITIAL_RECORD_FORM = { typeName: '', amount: 0, dueDate: '', paid: false };

export function FixedExpenses() {
  const {
    fixedExpenseTypes, fixedExpenseRecords,
    addFixedExpenseType, updateFixedExpenseType, deleteFixedExpenseType,
    addFixedExpenseRecord, markFixedExpensePaid, updateFixedExpenseRecord,
    generateMonthlyRecords,
  } = useStore();

  const [tab, setTab] = useState<'records' | 'types'>('records');
  const [monthFilter, setMonthFilter] = useState(getCurrentMonth());
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editRecordId, setEditRecordId] = useState<string | null>(null);
  const [typeForm, setTypeForm] = useState(INITIAL_TYPE_FORM);
  const [recordForm, setRecordForm] = useState(INITIAL_RECORD_FORM);
  const [typeError, setTypeError] = useState('');
  const [recordError, setRecordError] = useState('');

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = d.toISOString().slice(0, 7);
    return { value: val, label: formatMonthLabel(val) };
  });

  const monthRecords = fixedExpenseRecords.filter((r) => r.month === monthFilter);
  const totalMonth = monthRecords.reduce((a, r) => a + r.amount, 0);
  const paidMonth = monthRecords.filter((r) => r.paid).reduce((a, r) => a + r.amount, 0);
  const pendingMonth = totalMonth - paidMonth;

  const handleSaveType = () => {
    if (!typeForm.name.trim()) { setTypeError('El nombre del gasto es obligatorio.'); return; }
    addFixedExpenseType(typeForm);
    setShowTypeModal(false);
    setTypeForm(INITIAL_TYPE_FORM);
    setTypeError('');
  };

  const openNewRecord = () => {
    setEditRecordId(null);
    setRecordForm(INITIAL_RECORD_FORM);
    setRecordError('');
    setShowRecordModal(true);
  };

  const openEditRecord = (id: string) => {
    const r = fixedExpenseRecords.find((rec) => rec.id === id);
    if (!r) return;
    setEditRecordId(id);
    setRecordForm({ typeName: r.typeName, amount: r.amount, dueDate: r.dueDate, paid: r.paid });
    setRecordError('');
    setShowRecordModal(true);
  };

  const handleSaveRecord = () => {
    if (!recordForm.typeName.trim()) { setRecordError('El nombre del gasto es obligatorio.'); return; }
    if (recordForm.amount < 0) { setRecordError('El monto no puede ser negativo.'); return; }
    if (!recordForm.dueDate) { setRecordError('La fecha de vencimiento es obligatoria.'); return; }
    if (editRecordId) {
      updateFixedExpenseRecord(editRecordId, {
        typeName: recordForm.typeName.trim(),
        amount: recordForm.amount,
        dueDate: recordForm.dueDate,
        paid: recordForm.paid,
      });
    } else {
      addFixedExpenseRecord({
        typeId: '',
        typeName: recordForm.typeName.trim(),
        amount: recordForm.amount,
        dueDate: recordForm.dueDate,
        paid: recordForm.paid,
        month: monthFilter,
      });
    }
    setShowRecordModal(false);
    setEditRecordId(null);
    setRecordForm(INITIAL_RECORD_FORM);
    setRecordError('');
  };

  const handleGenerate = () => {
    generateMonthlyRecords(monthFilter);
  };

  const categoryLabel: Record<string, string> = {
    alquiler: 'Alquiler',
    servicios: 'Servicios',
    internet: 'Internet',
    impuestos: 'Impuestos',
    seguros: 'Seguros',
    sueldos: 'Sueldos',
    otro: 'Otro',
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Gastos Fijos</h1>
          <p className="text-slate-500 text-sm mt-0.5">Control de gastos recurrentes del negocio</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setTab(tab === 'records' ? 'types' : 'records')}>
            <Settings size={15} />
            {tab === 'records' ? 'Gestionar tipos' : 'Ver registros'}
          </Button>
          {tab === 'records' && (
            <>
              <Button variant="outline" onClick={handleGenerate}>
                <RefreshCw size={15} /> Generar mes
              </Button>
              <Button onClick={openNewRecord}>
                <Plus size={16} /> Agregar gasto
              </Button>
            </>
          )}
          {tab === 'types' && (
            <Button onClick={() => setShowTypeModal(true)}>
              <Plus size={16} /> Nuevo tipo
            </Button>
          )}
        </div>
      </div>

      {tab === 'records' && (
        <>
          {/* Month selector */}
          <div className="flex gap-3 items-center">
            <select
              value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
            >
              {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {/* Summary */}
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

          {/* Records */}
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Gastos de {formatMonthLabel(monthFilter)}</h3>
            </div>
            {monthRecords.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {monthRecords
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .map((r) => {
                    const isOverdue = !r.paid && r.dueDate < new Date().toISOString().split('T')[0];
                    return (
                      <div key={r.id} className={`flex items-center gap-4 px-6 py-4 hover:bg-slate-50 ${isOverdue ? 'border-l-2 border-red-400' : ''}`}>
                        <div className="flex-shrink-0">
                          {r.paid
                            ? <CheckCircle size={20} className="text-green-500" />
                            : <Clock size={20} className={isOverdue ? 'text-red-500' : 'text-slate-400'} />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900">{r.typeName}</p>
                          <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                            {r.paid
                              ? `Pagado el ${formatDate(r.paidDate)}`
                              : `Vence el ${formatDate(r.dueDate)}${isOverdue ? ' — VENCIDO' : ''}`
                            }
                          </p>
                        </div>
                        <span className="text-sm font-bold text-slate-900">{formatCurrency(r.amount)}</span>
                        {r.paid
                          ? <Badge variant="success">Pagado</Badge>
                          : (
                            <Button
                              size="sm"
                              variant={isOverdue ? 'danger' : 'secondary'}
                              onClick={() => markFixedExpensePaid(r.id)}
                            >
                              Pagar
                            </Button>
                          )
                        }
                        <button
                          onClick={() => openEditRecord(r.id)}
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="px-6 py-8 text-center">
                <p className="text-slate-400 text-sm">Sin gastos para este mes.</p>
                <Button variant="outline" className="mt-3" onClick={handleGenerate}>
                  <RefreshCw size={14} /> Generar desde plantillas
                </Button>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'types' && (
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Tipos de gastos fijos</h3>
            <p className="text-xs text-slate-500 mt-0.5">Plantillas para generar registros mensuales automáticamente</p>
          </div>
          {fixedExpenseTypes.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {fixedExpenseTypes.map((t) => (
                <div key={t.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.active ? 'bg-green-500' : 'bg-slate-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">
                      {categoryLabel[t.category] ?? t.category}
                      {t.recurring ? ' · Recurrente' : ''}
                      {` · Vence día ${t.dueDay}`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(t.defaultAmount)}</span>
                  <button
                    onClick={() => updateFixedExpenseType(t.id, { active: !t.active })}
                    className={`text-xs px-2 py-1 rounded-lg ${t.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {t.active ? 'Activo' : 'Inactivo'}
                  </button>
                  <button onClick={() => confirmDialog({ title: 'Eliminar tipo de gasto', message: `¿Eliminar "${t.name}"?`, confirmLabel: 'Eliminar', danger: true }).then((ok) => ok && deleteFixedExpenseType(t.id))} className="text-slate-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-6 py-8 text-center text-slate-400 text-sm">Sin tipos de gastos definidos</p>
          )}
        </Card>
      )}

      {/* New type modal */}
      <Modal
        isOpen={showTypeModal}
        onClose={() => { setShowTypeModal(false); setTypeForm(INITIAL_TYPE_FORM); setTypeError(''); }}
        title="Nuevo tipo de gasto"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowTypeModal(false); setTypeForm(INITIAL_TYPE_FORM); setTypeError(''); }}>Cancelar</Button>
            <Button onClick={handleSaveType}>Guardar tipo</Button>
          </>
        }
      >
        <div className="space-y-4">
          {typeError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{typeError}</p>}
          <Input label="Nombre del gasto" value={typeForm.name} onChange={(e) => { setTypeForm((f) => ({ ...f, name: e.target.value })); setTypeError(''); }} placeholder="Ej: Alquiler del local" />
          <Select label="Categoría" value={typeForm.category} onChange={(e) => setTypeForm((f) => ({ ...f, category: e.target.value }))} options={CATEGORIES} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Monto por defecto ($)" type="number" min="0" value={typeForm.defaultAmount} onChange={(e) => setTypeForm((f) => ({ ...f, defaultAmount: +e.target.value }))} />
            <Input label="Día de vencimiento" type="number" min="1" max="31" value={typeForm.dueDay} onChange={(e) => setTypeForm((f) => ({ ...f, dueDay: +e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={typeForm.recurring} onChange={(e) => setTypeForm((f) => ({ ...f, recurring: e.target.checked }))} />
            Gasto recurrente mensual
          </label>
        </div>
      </Modal>

      {/* Add / Edit record modal */}
      <Modal
        isOpen={showRecordModal}
        onClose={() => { setShowRecordModal(false); setEditRecordId(null); setRecordForm(INITIAL_RECORD_FORM); setRecordError(''); }}
        title={editRecordId ? 'Editar gasto' : 'Agregar gasto del mes'}
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowRecordModal(false); setEditRecordId(null); setRecordForm(INITIAL_RECORD_FORM); setRecordError(''); }}>Cancelar</Button>
            <Button onClick={handleSaveRecord}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {recordError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{recordError}</p>}
          <Input
            label="Nombre del gasto"
            value={recordForm.typeName}
            onChange={(e) => { setRecordForm((f) => ({ ...f, typeName: e.target.value })); setRecordError(''); }}
            placeholder="Ej: Alquiler, Luz, Internet, Monotributo..."
            autoFocus
          />
          {/* Sugerencias rápidas (solo en modo nuevo) */}
          {!editRecordId && fixedExpenseTypes.length > 0 && !recordForm.typeName && (
            <div className="flex flex-wrap gap-1.5">
              {fixedExpenseTypes.filter((t) => t.active).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setRecordForm((f) => ({
                    ...f,
                    typeName: t.name,
                    amount: t.defaultAmount,
                    dueDate: `${monthFilter}-${String(t.dueDay).padStart(2, '0')}`,
                  }))}
                  className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded-full hover:bg-brand-100 hover:text-brand-700 transition-colors"
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Monto ($)" type="number" min="0" value={recordForm.amount} onChange={(e) => setRecordForm((f) => ({ ...f, amount: +e.target.value }))} />
            <Input label="Fecha de vencimiento" type="date" value={recordForm.dueDate} onChange={(e) => setRecordForm((f) => ({ ...f, dueDate: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={recordForm.paid} onChange={(e) => setRecordForm((f) => ({ ...f, paid: e.target.checked }))} />
            Ya pagado
          </label>
        </div>
      </Modal>
    </div>
  );
}
