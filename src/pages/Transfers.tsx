import { useState } from 'react';
import {
  Plus, FileText, ChevronDown, ChevronUp, CheckSquare, Square,
  User, Car, Briefcase, Calendar,
} from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { Textarea } from '../components/ui/Input';
import { Input } from '../components/ui/Input';
import {
  formatDate, vehicleLabel, transfer08StatusLabel, transfer08StatusColor,
} from '../utils/formatters';

type Transfer08Status = 'pendiente' | 'en_tramite' | 'completado';

interface Transfer08 {
  id: string;
  vehicleId: string;
  clientId?: string;
  gestorId?: string;
  status: Transfer08Status;
  verificacionPolicial: boolean;
  verificacionFecha?: string;
  informeDominio: boolean;
  informeDominioFecha?: string;
  formulario08Firmado: boolean;
  tituloEntregado: boolean;
  cedulaEntregada: boolean;
  fechaEstimadaEntrega?: string;
  fechaCompletado?: string;
  notes: string;
  createdAt: string;
}

const INITIAL_FORM = {
  vehicleId: '',
  clientId: '',
  gestorId: '',
  notes: '',
};

const STATUS_FILTERS: { value: Transfer08Status | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_tramite', label: 'En Trámite' },
  { value: 'completado', label: 'Completado' },
];

function docsProgress(t: Transfer08): number {
  return [
    t.verificacionPolicial,
    t.informeDominio,
    t.formulario08Firmado,
    t.tituloEntregado,
    t.cedulaEntregada,
  ].filter(Boolean).length;
}

export function Transfers() {
  const { transfers = [], vehicles, clients, suppliers, addTransfer, updateTransfer } = useStore() as {
    transfers: Transfer08[];
    vehicles: any[];
    clients: any[];
    suppliers: any[];
    addTransfer: (t: Omit<Transfer08, 'id' | 'createdAt'>) => void;
    updateTransfer: (id: string, patch: Partial<Transfer08>) => void;
    deleteTransfer?: (id: string) => void;
  };

  const [statusFilter, setStatusFilter] = useState<Transfer08Status | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const gestores = suppliers.filter((s: any) => s.type === 'gestor');

  const filtered = transfers.filter(
    (t) => statusFilter === '' || t.status === statusFilter,
  );

  const field = (key: keyof typeof INITIAL_FORM, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = () => {
    if (!form.vehicleId) return;
    addTransfer({
      vehicleId: form.vehicleId,
      clientId: form.clientId || undefined,
      gestorId: form.gestorId || undefined,
      status: 'pendiente',
      verificacionPolicial: false,
      informeDominio: false,
      formulario08Firmado: false,
      tituloEntregado: false,
      cedulaEntregada: false,
      notes: form.notes,
    });
    setShowModal(false);
    setForm(INITIAL_FORM);
  };

  const toggle = (t: Transfer08, field: keyof Transfer08) => {
    updateTransfer(t.id, { [field]: !t[field] } as Partial<Transfer08>);
  };

  const setStatus = (t: Transfer08, status: Transfer08Status) => {
    const patch: Partial<Transfer08> = { status };
    if (status === 'completado') patch.fechaCompletado = new Date().toISOString().split('T')[0];
    updateTransfer(t.id, patch);
  };

  const getVehicle = (id: string) => vehicles.find((v: any) => v.id === id);
  const getClient = (id?: string) => id ? clients.find((c: any) => c.id === id) : null;
  const getGestor = (id?: string) => id ? suppliers.find((s: any) => s.id === id) : null;

  const vehicleOptions = vehicles.map((v: any) => ({
    value: v.id,
    label: vehicleLabel(v.brand, v.model, v.year) + ' · ' + v.patent,
  }));
  const clientOptions = [
    { value: '', label: 'Sin cliente asignado' },
    ...clients.map((c: any) => ({ value: c.id, label: c.name })),
  ];
  const gestorOptions = [
    { value: '', label: 'Sin gestor asignado' },
    ...gestores.map((g: any) => ({ value: g.id, label: g.name })),
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Transferencias</h1>
          <p className="text-slate-500 text-sm mt-0.5">{transfers.length} transferencias registradas</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nueva transferencia
        </Button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map(({ value, label }) => {
          const count = value === '' ? transfers.length : transfers.filter((t) => t.status === value).length;
          const isActive = statusFilter === value;
          const colorClass = value === '' ? 'bg-slate-100 text-slate-700' : transfer08StatusColor[value] ?? 'bg-slate-100 text-slate-700';
          return (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${colorClass} ${
                isActive ? 'ring-2 ring-offset-1 ring-current' : 'opacity-70 hover:opacity-100'
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card>
            <p className="text-center text-slate-400 py-8">No hay transferencias en este estado</p>
          </Card>
        )}
        {filtered.map((t) => {
          const vehicle = getVehicle(t.vehicleId);
          const client = getClient(t.clientId);
          const gestor = getGestor(t.gestorId);
          const progress = docsProgress(t);
          const isExpanded = expandedId === t.id;

          return (
            <Card key={t.id} padding={false}>
              {/* Row summary */}
              <button
                className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors rounded-xl"
                onClick={() => setExpandedId(isExpanded ? null : t.id)}
              >
                <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-brand-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">
                    {vehicle ? vehicleLabel(vehicle.brand, vehicle.model, vehicle.year) : 'Vehículo no encontrado'}
                    {vehicle && <span className="font-normal text-slate-500 ml-1">· {vehicle.patent}</span>}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {client && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <User size={11} /> {client.name}
                      </span>
                    )}
                    {gestor && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Briefcase size={11} /> {gestor.name}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar size={11} /> {formatDate(t.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Doc progress */}
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-500">Documentación</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-500 rounded-full transition-all"
                          style={{ width: `${(progress / 5) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{progress}/5</span>
                    </div>
                  </div>

                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${transfer08StatusColor[t.status]}`}>
                    {transfer08StatusLabel[t.status]}
                  </span>
                  {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-5">
                  {/* Checklist */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                      Documentación
                    </p>
                    <div className="space-y-2">
                      {/* Verificación policial */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggle(t, 'verificacionPolicial')}
                          className="flex-shrink-0 text-brand-600"
                        >
                          {t.verificacionPolicial
                            ? <CheckSquare size={18} />
                            : <Square size={18} className="text-slate-300" />}
                        </button>
                        <span className={`text-sm flex-1 ${t.verificacionPolicial ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          Verificación policial
                        </span>
                        <input
                          type="date"
                          value={t.verificacionFecha ?? ''}
                          onChange={(e) => updateTransfer(t.id, { verificacionFecha: e.target.value })}
                          className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                        />
                      </div>

                      {/* Informe de dominio */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggle(t, 'informeDominio')}
                          className="flex-shrink-0 text-brand-600"
                        >
                          {t.informeDominio
                            ? <CheckSquare size={18} />
                            : <Square size={18} className="text-slate-300" />}
                        </button>
                        <span className={`text-sm flex-1 ${t.informeDominio ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          Informe de dominio
                        </span>
                        <input
                          type="date"
                          value={t.informeDominioFecha ?? ''}
                          onChange={(e) => updateTransfer(t.id, { informeDominioFecha: e.target.value })}
                          className="text-xs border border-slate-200 rounded px-2 py-1 text-slate-600 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                        />
                      </div>

                      {/* Formulario 08 */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggle(t, 'formulario08Firmado')}
                          className="flex-shrink-0 text-brand-600"
                        >
                          {t.formulario08Firmado
                            ? <CheckSquare size={18} />
                            : <Square size={18} className="text-slate-300" />}
                        </button>
                        <span className={`text-sm flex-1 ${t.formulario08Firmado ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          Formulario 08 firmado
                        </span>
                      </div>

                      {/* Título entregado */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggle(t, 'tituloEntregado')}
                          className="flex-shrink-0 text-brand-600"
                        >
                          {t.tituloEntregado
                            ? <CheckSquare size={18} />
                            : <Square size={18} className="text-slate-300" />}
                        </button>
                        <span className={`text-sm flex-1 ${t.tituloEntregado ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          Título entregado
                        </span>
                      </div>

                      {/* Cédula entregada */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggle(t, 'cedulaEntregada')}
                          className="flex-shrink-0 text-brand-600"
                        >
                          {t.cedulaEntregada
                            ? <CheckSquare size={18} />
                            : <Square size={18} className="text-slate-300" />}
                        </button>
                        <span className={`text-sm flex-1 ${t.cedulaEntregada ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          Cédula entregada
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Fecha estimada */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-600 flex-shrink-0">Fecha estimada de entrega</label>
                    <input
                      type="date"
                      value={t.fechaEstimadaEntrega ?? ''}
                      onChange={(e) => updateTransfer(t.id, { fechaEstimadaEntrega: e.target.value })}
                      className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>

                  {/* Notes */}
                  {t.notes && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notas</p>
                      <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{t.notes}</p>
                    </div>
                  )}

                  {/* Status actions */}
                  <div className="flex gap-2 flex-wrap pt-1">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider self-center mr-1">Estado:</p>
                    {(['pendiente', 'en_tramite', 'completado'] as Transfer08Status[]).map((s) => (
                      <button
                        key={s}
                        disabled={t.status === s}
                        onClick={() => setStatus(t, s)}
                        className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                          t.status === s
                            ? transfer08StatusColor[s] + ' ring-2 ring-current ring-offset-1'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {transfer08StatusLabel[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Modal nueva transferencia */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setForm(INITIAL_FORM); }}
        title="Nueva transferencia"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setForm(INITIAL_FORM); }}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!form.vehicleId}>
              Crear transferencia
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Vehículo *"
            value={form.vehicleId}
            onChange={(e) => field('vehicleId', e.target.value)}
            options={vehicleOptions}
            placeholder="Seleccionar vehículo"
          />
          <Select
            label="Cliente"
            value={form.clientId}
            onChange={(e) => field('clientId', e.target.value)}
            options={clientOptions}
          />
          <Select
            label="Gestor"
            value={form.gestorId}
            onChange={(e) => field('gestorId', e.target.value)}
            options={gestorOptions}
          />
          <Textarea
            label="Notas"
            value={form.notes}
            onChange={(e) => field('notes', e.target.value)}
            placeholder="Observaciones del trámite..."
          />
        </div>
      </Modal>
    </div>
  );
}
