import { useState } from 'react';
import {
  Wallet, Plus, ArrowUpCircle, ArrowDownCircle,
  Lock, Unlock, Trash2,
} from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatDate } from '../utils/formatters';

const MOVEMENT_CATEGORIES = [
  { value: 'venta',       label: 'Venta de vehículo' },
  { value: 'cuota',       label: 'Cobro de cuota' },
  { value: 'gasto_fijo',  label: 'Gasto fijo' },
  { value: 'proveedor',   label: 'Pago a proveedor' },
  { value: 'retiro',      label: 'Retiro personal' },
  { value: 'otro',        label: 'Otro' },
];

const INITIAL_MOVEMENT = {
  type: 'ingreso' as 'ingreso' | 'egreso',
  category: 'otro',
  description: '',
  amount: 0,
};

export function DailyCash() {
  const {
    dailyCashes, cashMovements,
    openDailyCash, closeDailyCash, addCashMovement, deleteCashMovement,
  } = useStore();

  const today = new Date().toISOString().split('T')[0];
  const todayCash = dailyCashes.find((dc) => dc.date === today);
  const todayMovements = todayCash ? cashMovements.filter((m) => m.dailyCashId === todayCash.id) : [];

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [closingNotes, setClosingNotes] = useState('');
  const [movementForm, setMovementForm] = useState(INITIAL_MOVEMENT);

  // Calcular saldo actual de caja
  const todayIngresos = todayMovements.filter((m) => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0);
  const todayEgresos = todayMovements.filter((m) => m.type === 'egreso').reduce((a, m) => a + m.amount, 0);
  const saldoActual = (todayCash?.openingBalance ?? 0) + todayIngresos - todayEgresos;

  const handleOpen = () => {
    openDailyCash(today, openingBalance);
    setShowOpenModal(false);
    setOpeningBalance(0);
  };

  const handleClose = () => {
    if (!todayCash) return;
    closeDailyCash(todayCash.id, closingBalance, closingNotes);
    setShowCloseModal(false);
    setClosingBalance(0);
    setClosingNotes('');
  };

  const handleAddMovement = () => {
    if (!todayCash || !movementForm.description.trim() || !movementForm.amount) return;
    addCashMovement({
      dailyCashId: todayCash.id,
      ...movementForm,
    });
    setMovementForm(INITIAL_MOVEMENT);
    setShowMovementModal(false);
  };

  // Historia de cajas
  const pastCashes = [...dailyCashes]
    .filter((dc) => dc.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const categoryLabel = (cat: string) =>
    MOVEMENT_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Caja Diaria</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? 'Ver hoy' : 'Ver historial'}
          </Button>
          {todayCash && !todayCash.closed && (
            <>
              <Button variant="secondary" onClick={() => { setShowMovementModal(true); }}>
                <Plus size={15} /> Movimiento
              </Button>
              <Button variant="danger" onClick={() => { setClosingBalance(saldoActual); setShowCloseModal(true); }}>
                <Lock size={15} /> Cerrar caja
              </Button>
            </>
          )}
          {!todayCash && (
            <Button onClick={() => setShowOpenModal(true)}>
              <Unlock size={15} /> Abrir caja
            </Button>
          )}
        </div>
      </div>

      {!showHistory ? (
        <>
          {/* Estado de caja hoy */}
          {!todayCash ? (
            <Card>
              <div className="py-10 text-center">
                <Wallet size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">La caja de hoy no está abierta</p>
                <p className="text-slate-400 text-sm mt-1">Abrí la caja para registrar movimientos del día.</p>
                <Button className="mt-4" onClick={() => setShowOpenModal(true)}>
                  <Unlock size={15} /> Abrir caja de hoy
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {/* KPIs del día */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-slate-50">
                  <p className="text-xs text-slate-500 font-medium">Apertura</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(todayCash.openingBalance)}</p>
                </Card>
                <Card className="bg-green-50">
                  <p className="text-xs text-slate-500 font-medium">Ingresos</p>
                  <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(todayIngresos)}</p>
                </Card>
                <Card className="bg-red-50">
                  <p className="text-xs text-slate-500 font-medium">Egresos</p>
                  <p className="text-xl font-bold text-red-700 mt-1">{formatCurrency(todayEgresos)}</p>
                </Card>
                <Card className={saldoActual >= 0 ? 'bg-blue-50' : 'bg-amber-50'}>
                  <p className="text-xs text-slate-500 font-medium">Saldo actual</p>
                  <p className={`text-xl font-bold mt-1 ${saldoActual >= 0 ? 'text-brand-600' : 'text-amber-700'}`}>
                    {formatCurrency(saldoActual)}
                  </p>
                </Card>
              </div>

              {todayCash.closed && (
                <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-slate-600">
                  <Lock size={15} className="flex-shrink-0" />
                  Caja cerrada con saldo de <strong className="ml-1">{formatCurrency(todayCash.closingBalance ?? 0)}</strong>
                  {todayCash.notes && <span className="ml-2 text-slate-400">· {todayCash.notes}</span>}
                </div>
              )}

              {/* Movimientos del día */}
              <Card padding={false}>
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Movimientos de hoy</h3>
                  {!todayCash.closed && (
                    <Button size="sm" onClick={() => setShowMovementModal(true)}>
                      <Plus size={14} /> Agregar
                    </Button>
                  )}
                </div>
                {todayMovements.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {[...todayMovements]
                      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                      .map((m) => (
                        <div key={m.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-slate-50">
                          <div className="flex-shrink-0">
                            {m.type === 'ingreso'
                              ? <ArrowUpCircle size={20} className="text-green-500" />
                              : <ArrowDownCircle size={20} className="text-red-500" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{m.description}</p>
                            <p className="text-xs text-slate-500">{categoryLabel(m.category)}</p>
                          </div>
                          <span className={`text-sm font-bold ${m.type === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                            {m.type === 'egreso' ? '−' : '+'}{formatCurrency(m.amount)}
                          </span>
                          {!todayCash.closed && (
                            <button
                              onClick={() => deleteCashMovement(m.id)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="px-6 py-8 text-center text-slate-400 text-sm">
                    Sin movimientos registrados. Agregá ingresos y egresos del día.
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      ) : (
        /* Historial de cajas */
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Historial de cajas</h3>
          </div>
          {pastCashes.length === 0 ? (
            <p className="px-6 py-8 text-center text-slate-400 text-sm">Sin historial disponible.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pastCashes.map((dc) => {
                const movements = cashMovements.filter((m) => m.dailyCashId === dc.id);
                const ingresos = movements.filter((m) => m.type === 'ingreso').reduce((a, m) => a + m.amount, 0);
                const egresos = movements.filter((m) => m.type === 'egreso').reduce((a, m) => a + m.amount, 0);
                const saldo = dc.closingBalance ?? (dc.openingBalance + ingresos - egresos);
                return (
                  <div key={dc.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{formatDate(dc.date)}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span className="text-green-600">+{formatCurrency(ingresos)}</span>
                        <span className="text-red-600">−{formatCurrency(egresos)}</span>
                        <span>{movements.length} mov.</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(saldo)}</p>
                      <p className="text-xs text-slate-400">cierre</p>
                    </div>
                    <Badge variant={dc.closed ? 'default' : 'warning'}>
                      {dc.closed ? 'Cerrada' : 'Abierta'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Modal: Abrir caja */}
      <Modal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Abrir caja del día"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowOpenModal(false)}>Cancelar</Button>
            <Button onClick={handleOpen}>Abrir caja</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Ingresá el saldo inicial de caja (efectivo disponible al momento de abrir).
          </p>
          <Input
            label="Saldo de apertura ($)"
            type="number"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(+e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      {/* Modal: Cerrar caja */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Cerrar caja del día"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleClose}>Cerrar caja</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Saldo calculado:</span>
              <span className="font-bold text-slate-900">{formatCurrency(saldoActual)}</span>
            </div>
          </div>
          <Input
            label="Saldo real al cierre ($)"
            type="number"
            value={closingBalance}
            onChange={(e) => setClosingBalance(+e.target.value)}
            hint="Contá el efectivo físico y anotá el total real."
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas (opcional)</label>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Diferencias, observaciones..."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600 resize-none"
            />
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar movimiento */}
      <Modal
        isOpen={showMovementModal}
        onClose={() => setShowMovementModal(false)}
        title="Agregar movimiento"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowMovementModal(false)}>Cancelar</Button>
            <Button onClick={handleAddMovement}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMovementForm((f) => ({ ...f, type: 'ingreso' }))}
                className={`flex items-center gap-2 justify-center px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  movementForm.type === 'ingreso'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <ArrowUpCircle size={16} /> Ingreso
              </button>
              <button
                type="button"
                onClick={() => setMovementForm((f) => ({ ...f, type: 'egreso' }))}
                className={`flex items-center gap-2 justify-center px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                  movementForm.type === 'egreso'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <ArrowDownCircle size={16} /> Egreso
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoría</label>
            <select
              value={movementForm.category}
              onChange={(e) => setMovementForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
            >
              {MOVEMENT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <Input
            label="Descripción"
            value={movementForm.description}
            onChange={(e) => setMovementForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ej: Venta Gol 2018, Pago lavadero..."
            autoFocus
          />
          <Input
            label="Monto ($)"
            type="number"
            value={movementForm.amount}
            onChange={(e) => setMovementForm((f) => ({ ...f, amount: +e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
