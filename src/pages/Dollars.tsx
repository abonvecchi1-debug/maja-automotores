import { useState } from 'react';
import { DollarSign, TrendingUp, Plus, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react';
import { useStore } from '../store';
import type { UsdOperation, UsdOperationType } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { confirmDialog, notify } from '../components/ui/Feedback';
import { formatCurrency, formatDate } from '../utils/formatters';

const fmtUsd = (n: number) => 'U$S ' + (n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });

/**
 * Recorre las operaciones en orden cronológico llevando la tenencia y el "pozo" de costo
 * en pesos. La compra suma dólares y costo. La venta realiza la ganancia contra el PRECIO
 * PROMEDIO (pozo / tenencia) y saca del pozo el costo promedio de lo vendido.
 */
function computeUsd(ops: UsdOperation[]) {
  const sorted = [...ops].sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
  let holdings = 0, costPool = 0, realized = 0;
  const rows = sorted.map((op) => {
    if (op.type === 'compra') {
      holdings += op.amountUsd;
      costPool += op.amountPesos;
      return { op, profit: null as number | null, avgAtSale: null as number | null };
    }
    const avg = holdings > 0 ? costPool / holdings : 0;
    const cost = op.amountUsd * avg;
    const profit = op.amountPesos - cost;
    realized += profit;
    holdings -= op.amountUsd;
    costPool -= cost;
    return { op, profit, avgAtSale: avg };
  });
  const avgCost = holdings > 0.0001 ? costPool / holdings : 0;
  return { holdings: Math.max(0, holdings), avgCost, costPool: Math.max(0, costPool), realized, rows };
}

const emptyForm = {
  type: 'compra' as UsdOperationType,
  amountUsd: 0,
  rate: 0,
  date: new Date().toISOString().split('T')[0],
  notes: '',
};

export function Dollars() {
  const { usdOperations, addUsdOperation, deleteUsdOperation } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { holdings, avgCost, costPool, realized, rows } = computeUsd(usdOperations);

  const total = form.amountUsd * form.rate;
  const sellProfit = form.type === 'venta' ? form.amountUsd * (form.rate - avgCost) : 0;

  const openModal = (type: UsdOperationType) => {
    setForm({ ...emptyForm, type, date: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.amountUsd || form.amountUsd <= 0) { notify('Poné cuántos dólares.', 'error'); return; }
    if (!form.rate || form.rate <= 0) { notify('Poné la cotización (precio del dólar).', 'error'); return; }
    if (form.type === 'venta' && form.amountUsd > holdings + 0.0001) {
      notify(`No podés vender ${fmtUsd(form.amountUsd)}: solo tenés ${fmtUsd(holdings)}.`, 'error');
      return;
    }
    addUsdOperation({
      type: form.type,
      amountUsd: form.amountUsd,
      rate: form.rate,
      amountPesos: form.amountUsd * form.rate,
      date: form.date,
      notes: form.notes.trim(),
    });
    setShowModal(false);
  };

  const handleDelete = (op: UsdOperation) => {
    confirmDialog({
      title: 'Eliminar operación',
      message: `¿Eliminar esta ${op.type} de ${fmtUsd(op.amountUsd)} a $${op.rate.toLocaleString('es-AR')}? Se recalcula el promedio y la ganancia.`,
      confirmLabel: 'Eliminar', danger: true,
    }).then((ok) => ok && deleteUsdOperation(op.id));
  };

  const sortedRows = [...rows].reverse(); // más reciente arriba en el historial

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Dólares</h1>
          <p className="text-slate-500 text-sm mt-0.5">Compra-venta de divisas · ganancia por precio promedio</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openModal('compra')}><ArrowDownCircle size={16} /> Comprar</Button>
          <Button onClick={() => openModal('venta')}><ArrowUpCircle size={16} /> Vender</Button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-emerald-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl"><DollarSign size={22} className="text-emerald-600" /></div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Tenencia en dólares</p>
              <p className="text-2xl font-bold text-emerald-700">{fmtUsd(holdings)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl"><Wallet size={22} className="text-slate-500" /></div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Precio promedio de compra</p>
              <p className="text-2xl font-bold text-slate-800">{holdings > 0 ? formatCurrency(avgCost) : '—'}</p>
              <p className="text-[11px] text-slate-400">por dólar</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 rounded-xl"><Wallet size={22} className="text-slate-500" /></div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Valor en pesos (al promedio)</p>
              <p className="text-2xl font-bold text-slate-800">{formatCurrency(costPool)}</p>
              <p className="text-[11px] text-slate-400">lo que te costó lo que tenés</p>
            </div>
          </div>
        </Card>
        <Card className={realized >= 0 ? 'bg-brand-50' : 'bg-red-50'}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${realized >= 0 ? 'bg-brand-100' : 'bg-red-100'}`}>
              <TrendingUp size={22} className={realized >= 0 ? 'text-brand-600' : 'text-red-600'} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 font-medium">Ganancia realizada</p>
              <p className={`text-2xl font-bold ${realized >= 0 ? 'text-brand-700' : 'text-red-700'}`}>{formatCurrency(realized)}</p>
              <p className="text-[11px] text-slate-400">por dólares ya vendidos</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Historial */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Operaciones</h3>
        </div>
        {sortedRows.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {sortedRows.map(({ op, profit, avgAtSale }) => {
              const isBuy = op.type === 'compra';
              return (
                <div key={op.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isBuy ? 'bg-emerald-100' : 'bg-brand-100'}`}>
                    {isBuy ? <ArrowDownCircle size={18} className="text-emerald-600" /> : <ArrowUpCircle size={18} className="text-brand-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {isBuy ? 'Compra' : 'Venta'} de {fmtUsd(op.amountUsd)}
                      <span className="text-slate-400 font-normal"> a {formatCurrency(op.rate)}/US$</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(op.date)} · {formatCurrency(op.amountPesos)}
                      {op.notes ? ` · ${op.notes}` : ''}
                      {!isBuy && avgAtSale != null && <span className="text-slate-400"> · promedio compra {formatCurrency(avgAtSale)}</span>}
                    </p>
                  </div>
                  {!isBuy && profit != null && (
                    <span className={`text-sm font-bold flex-shrink-0 ${profit >= 0 ? 'text-brand-700' : 'text-red-700'}`}>
                      {profit >= 0 ? '+' : ''}{formatCurrency(profit)}
                    </span>
                  )}
                  <button onClick={() => handleDelete(op)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0" title="Eliminar">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">Todavía no cargaste operaciones. Empezá con "Comprar".</p>
        )}
      </Card>

      {/* Modal comprar/vender */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={form.type === 'compra' ? 'Comprar dólares' : 'Vender dólares'}>
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['compra', 'venta'] as UsdOperationType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border-2 transition-colors ${
                  form.type === t ? 'bg-brand-50 border-brand-400 text-brand-700' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {t === 'compra' ? 'Comprar' : 'Vender'}
              </button>
            ))}
          </div>

          {form.type === 'venta' && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
              Tenés <b>{fmtUsd(holdings)}</b> a un promedio de <b>{holdings > 0 ? formatCurrency(avgCost) : '—'}</b> por dólar.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Cantidad de dólares (US$)" type="number" value={form.amountUsd || ''} onChange={(e) => setForm((f) => ({ ...f, amountUsd: +e.target.value }))} placeholder="1000" />
            <Input label="Cotización ($ por dólar)" type="number" value={form.rate || ''} onChange={(e) => setForm((f) => ({ ...f, rate: +e.target.value }))} placeholder="1200" />
          </div>
          <Input label="Fecha" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          <Input label="Nota (opcional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Ej: le compré a Fulano" />

          {total > 0 && (
            <div className="bg-brand-50 rounded-lg px-4 py-3 text-sm space-y-1">
              <p className="text-slate-700">
                {form.type === 'compra' ? 'Pagás' : 'Cobrás'}: <b>{formatCurrency(total)}</b>
              </p>
              {form.type === 'venta' && holdings > 0 && (
                <p className={sellProfit >= 0 ? 'text-brand-700' : 'text-red-700'}>
                  Ganancia de esta venta: <b>{sellProfit >= 0 ? '+' : ''}{formatCurrency(sellProfit)}</b>
                  <span className="text-slate-400 font-normal"> (contra promedio {formatCurrency(avgCost)})</span>
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}><Plus size={16} /> Registrar {form.type === 'compra' ? 'compra' : 'venta'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
