import { useState } from 'react';
import {
  Plus, Search, MessageSquare, Phone, Instagram,
  ChevronDown, Trash2, Send, History,
} from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Badge } from '../components/ui/Badge';
import { confirmDialog } from '../components/ui/Feedback';
import { formatDate } from '../utils/formatters';
import type { LeadStatus, LeadSource } from '../types';

const STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'consulta',    label: 'Consulta',    color: 'bg-slate-100 text-slate-700' },
  { value: 'interesado',  label: 'Interesado',  color: 'bg-blue-100 text-blue-700' },
  { value: 'negociando',  label: 'Negociando',  color: 'bg-amber-100 text-amber-700' },
  { value: 'descartado',  label: 'Descartado',  color: 'bg-red-100 text-red-700' },
  { value: 'compro',      label: 'Compró',      color: 'bg-green-100 text-green-700' },
];

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'whatsapp',      label: 'WhatsApp' },
  { value: 'mercadolibre',  label: 'MercadoLibre' },
  { value: 'facebook',      label: 'Facebook' },
  { value: 'instagram',     label: 'Instagram' },
  { value: 'olx',           label: 'OLX' },
  { value: 'presencial',    label: 'Presencial' },
  { value: 'referido',      label: 'Referido' },
  { value: 'otro',          label: 'Otro' },
];

const SOURCE_ICONS: Partial<Record<LeadSource, React.ElementType>> = {
  whatsapp:     MessageSquare,
  instagram:    Instagram,
  presencial:   Phone,
};

const INITIAL_FORM = {
  name: '', phone: '', email: '',
  vehicleId: '', source: 'whatsapp' as LeadSource,
  status: 'consulta' as LeadStatus, notes: '',
};

function statusInfo(status: LeadStatus) {
  return STATUS_OPTIONS.find((s) => s.value === status) ?? STATUS_OPTIONS[0];
}

function sourceLabel(source: LeadSource) {
  return SOURCE_OPTIONS.find((s) => s.value === source)?.label ?? source;
}

export function Leads() {
  const { leads, vehicles, addLead, updateLead, deleteLead, addContactEntry } = useStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | ''>('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contactNote, setContactNote] = useState('');
  const [addingNoteFor, setAddingNoteFor] = useState<string | null>(null);

  const availableVehicles = vehicles.filter((v) => v.status !== 'vendido');

  const filtered = leads.filter((l) => {
    const matchSearch = search === '' ||
      `${l.name} ${l.phone} ${l.notes}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === '' || l.status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s.value] = leads.filter((l) => l.status === s.value).length;
    return acc;
  }, {} as Record<LeadStatus, number>);

  const openNew = () => {
    setEditId(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  };

  const openEdit = (id: string) => {
    const l = leads.find((lead) => lead.id === id);
    if (!l) return;
    setEditId(id);
    setForm({
      name: l.name, phone: l.phone, email: l.email ?? '',
      vehicleId: l.vehicleId ?? '', source: l.source,
      status: l.status, notes: l.notes,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { setFormError('El nombre es obligatorio.'); return; }
    if (!form.phone.trim()) { setFormError('El teléfono es obligatorio.'); return; }
    setFormError('');
    const payload = {
      ...form,
      email: form.email || undefined,
      vehicleId: form.vehicleId || undefined,
    };
    if (editId) {
      updateLead(editId, payload);
    } else {
      addLead(payload);
    }
    setShowModal(false);
  };

  const handleAddNote = (leadId: string) => {
    if (!contactNote.trim()) return;
    addContactEntry(leadId, contactNote.trim());
    setContactNote('');
    setAddingNoteFor(null);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Consultas</h1>
          <p className="text-slate-500 text-sm mt-0.5">Seguimiento de interesados y potenciales compradores</p>
        </div>
        <Button onClick={openNew}>
          <Plus size={16} /> Nueva consulta
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === '' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos ({leads.length})
        </button>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s.value ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {s.label} ({counts[s.value] ?? 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
        />
      </div>

      {/* Leads list */}
      {filtered.length === 0 ? (
        <Card>
          <div className="py-8 text-center">
            <MessageSquare size={32} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Sin consultas{search || statusFilter ? ' que coincidan con los filtros' : ''}.</p>
            {!search && !statusFilter && (
              <Button variant="outline" className="mt-4" onClick={openNew}>
                <Plus size={14} /> Registrar primera consulta
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => {
            const vehicle = lead.vehicleId ? vehicles.find((v) => v.id === lead.vehicleId) : null;
            const info = statusInfo(lead.status);
            const isExpanded = expandedId === lead.id;
            const SourceIcon = SOURCE_ICONS[lead.source];

            return (
              <Card key={lead.id} padding={false}>
                {/* Main row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {lead.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{lead.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${info.color}`}>
                        {info.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        {SourceIcon && <SourceIcon size={11} />}
                        {sourceLabel(lead.source)}
                      </span>
                      <span>{lead.phone}</span>
                      {vehicle && (
                        <span className="text-brand-600 font-medium">{vehicle.brand} {vehicle.model} {vehicle.year}</span>
                      )}
                      <span className="text-slate-400">{formatDate(lead.createdAt)}</span>
                    </div>
                    {lead.notes && (
                      <p className="text-xs text-slate-500 mt-1 truncate">{lead.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Quick status change */}
                    <select
                      value={lead.status}
                      onChange={(e) => updateLead(lead.id, { status: e.target.value as LeadStatus })}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-brand-500"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : lead.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      title="Historial de contacto"
                    >
                      <History size={15} />
                    </button>
                    <button
                      onClick={() => openEdit(lead.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      title="Editar"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      onClick={() => confirmDialog({ title: 'Eliminar consulta', message: `¿Eliminar la consulta de "${lead.name}"?`, confirmLabel: 'Eliminar', danger: true }).then((ok) => ok && deleteLead(lead.id))}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded contact history */}
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Historial de contacto</p>
                    {lead.contactHistory.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {[...lead.contactHistory]
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((entry) => (
                            <div key={entry.id} className="flex gap-2 text-sm">
                              <span className="text-slate-400 text-xs flex-shrink-0 mt-0.5">{formatDate(entry.date)}</span>
                              <p className="text-slate-700">{entry.note}</p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mb-3">Sin registros de contacto.</p>
                    )}
                    {addingNoteFor === lead.id ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={contactNote}
                          onChange={(e) => setContactNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddNote(lead.id);
                            if (e.key === 'Escape') { setAddingNoteFor(null); setContactNote(''); }
                          }}
                          placeholder="Ej: Llamé, quedó en venir el jueves..."
                          className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600"
                        />
                        <Button size="sm" onClick={() => handleAddNote(lead.id)}>
                          <Send size={13} />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setAddingNoteFor(null); setContactNote(''); }}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setAddingNoteFor(lead.id)}>
                        <Plus size={13} /> Registrar contacto
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal agregar/editar */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setFormError(''); }}
        title={editId ? 'Editar consulta' : 'Nueva consulta'}
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setFormError(''); }}>Cancelar</Button>
            <Button onClick={handleSave}>Guardar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>}
          <Input
            label="Nombre del interesado"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Juan Pérez"
            autoFocus
          />
          <Input
            label="Teléfono / WhatsApp"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="11 2345-6789"
          />
          <Input
            label="Email (opcional)"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="juan@email.com"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Canal de origen</label>
              <select
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as LeadSource }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
              >
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Estado</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LeadStatus }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Vehículo de interés (opcional)</label>
            <select
              value={form.vehicleId}
              onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
            >
              <option value="">— Sin vehículo específico —</option>
              {availableVehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} {v.year}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Detalles relevantes de la consulta..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600 resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
