import { useState } from 'react';
import { Package, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { confirmDialog, notify } from '../components/ui/Feedback';
import { formatCurrency, formatDate } from '../utils/formatters';

const emptyForm = {
  description: '',
  value: 0,
  purchaseDate: new Date().toISOString().split('T')[0],
  notes: '',
};

export function CapitalAssets() {
  const { capitalAssets, cheques, addCapitalAsset, deleteCapitalAsset } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [payChequeIds, setPayChequeIds] = useState<string[]>([]);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const carteraCheques = cheques.filter((c) => c.moneda === 'ARS' && c.estado === 'en_cartera');
  const chequeTotal = cheques.filter((c) => payChequeIds.includes(c.id)).reduce((a, c) => a + c.monto, 0);
  const enPesos = Math.max(0, form.value - chequeTotal);

  const total = capitalAssets.reduce((a, x) => a + (x.value ?? 0), 0);

  const openModal = () => { setForm(emptyForm); setPayChequeIds([]); setShowModal(true); };

  const handleSave = () => {
    if (!form.description.trim()) { notify('Poné qué compraste (ej: Trailer).', 'error'); return; }
    if (!form.value || form.value <= 0) { notify('Poné el valor.', 'error'); return; }
    addCapitalAsset(
      { description: form.description.trim(), value: form.value, purchaseDate: form.purchaseDate, notes: form.notes.trim() },
      payChequeIds,
    );
    setShowModal(false);
  };

  const handleDelete = (id: string, desc: string) => {
    confirmDialog({ title: 'Eliminar bien', message: `¿Eliminar "${desc}"? Sale del Capital.`, confirmLabel: 'Eliminar', danger: true })
      .then((ok) => ok && deleteCapitalAsset(id));
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Bienes de capital</h1>
          <p className="text-slate-500 text-sm mt-0.5">Trailer, herramientas y bienes propios. Suman al Capital, no son gasto.</p>
        </div>
        <Button onClick={openModal}><Plus size={16} /> Nuevo bien</Button>
      </div>

      <Card className="bg-amber-50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 rounded-xl"><Package size={22} className="text-amber-600" /></div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total en bienes de capital</p>
            <p className="text-2xl font-bold text-amber-700">{formatCurrency(total)}</p>
            <p className="text-[11px] text-slate-400">Se suma al Capital de Finanzas (junto con los autos).</p>
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <div className="px-6 py-4 border-b border-slate-100"><h3 className="font-semibold text-slate-900">Tus bienes</h3></div>
        {capitalAssets.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {capitalAssets.map((x) => (
              <div key={x.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{x.description}</p>
                  <p className="text-xs text-slate-500">{formatDate(x.purchaseDate)}{x.notes ? ` · ${x.notes}` : ''}</p>
                </div>
                <span className="text-sm font-bold text-amber-700 flex-shrink-0">{formatCurrency(x.value)}</span>
                <button onClick={() => handleDelete(x.id, x.description)} className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0" title="Eliminar">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">Todavía no cargaste bienes de capital.</p>
        )}
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nuevo bien de capital">
        <div className="space-y-4">
          <Input label="¿Qué compraste?" value={form.description} onChange={(e) => set({ description: e.target.value })} placeholder="Ej: Trailer para 2 autos" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valor / costo ($)" type="number" value={form.value || ''} onChange={(e) => set({ value: +e.target.value })} placeholder="8000000" />
            <Input label="Fecha" type="date" value={form.purchaseDate} onChange={(e) => set({ purchaseDate: e.target.value })} />
          </div>
          <Input label="Nota (opcional)" value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="A quién se lo compraste, etc." />

          {carteraCheques.length > 0 && (
            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-700">¿Pagaste con cheque(s) de tu cartera?</p>
              <div className="space-y-1.5 max-h-40 overflow-auto">
                {carteraCheques.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={payChequeIds.includes(c.id)}
                      onChange={(e) => setPayChequeIds((ids) => e.target.checked ? [...ids, c.id] : ids.filter((x) => x !== c.id))}
                      className="w-4 h-4 accent-brand-600"
                    />
                    <span className="text-slate-700">{formatCurrency(c.monto)} · {c.banco || 'cheque'} Nº{c.numero} <span className="text-slate-400">({c.librador})</span></span>
                  </label>
                ))}
              </div>
              {form.value > 0 && (
                <p className="text-[11px] text-slate-500">
                  {chequeTotal > 0 && <>Cheques: <b>{formatCurrency(chequeTotal)}</b> · </>}
                  El resto en pesos: <b>{formatCurrency(enPesos)}</b>
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave}><Plus size={16} /> Guardar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
