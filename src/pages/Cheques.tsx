import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, FileDown, TableIcon, X, ChevronDown, AlertTriangle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TOKEN_KEY = 'maja-auth-token';
const getToken = () => localStorage.getItem(TOKEN_KEY);

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Estado = 'en_cartera' | 'depositado' | 'entregado' | 'cobrado' | 'rechazado';
type Tipo = 'al_dia' | 'diferido';
type Moneda = 'ARS' | 'USD';

interface Cheque {
  id: string;
  numero: string;
  serie: string;
  banco: string;
  monto: number;
  moneda: Moneda;
  fechaEmision: string;
  fechaVencimiento: string;
  tipo: Tipo;
  alPortador: boolean;
  endosado: boolean;
  endosadoPor: string;
  dniEndosante: string;
  librador: string;
  cuitLibrador: string;
  recibidoDe: string;
  entregadoA: string;
  estado: Estado;
  observaciones: string;
  createdAt: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const estadoLabel: Record<Estado, string> = {
  en_cartera: 'En cartera',
  depositado: 'Depositado',
  entregado: 'Entregado',
  cobrado: 'Cobrado',
  rechazado: 'Rechazado',
};

const estadoColor: Record<Estado, string> = {
  en_cartera: 'bg-blue-100 text-blue-800',
  depositado: 'bg-purple-100 text-purple-800',
  entregado: 'bg-orange-100 text-orange-800',
  cobrado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
};

function $$(n: number, moneda: Moneda = 'ARS') {
  const sym = moneda === 'USD' ? 'U$S ' : '$';
  return sym + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d: string) {
  if (!d) return '-';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function daysUntil(dateStr: string) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function vencimientoAlert(cheque: Cheque) {
  if (cheque.estado === 'cobrado' || cheque.estado === 'depositado' || cheque.estado === 'rechazado') return null;
  const days = daysUntil(cheque.fechaVencimiento);
  if (days === null) return null;
  if (days < 0) return 'vencido';
  if (days <= 7) return 'proximo';
  return null;
}

function unique(arr: string[]) {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

/* ─── Empty form ─────────────────────────────────────────────────────────── */

function emptyForm(): Omit<Cheque, 'id' | 'createdAt'> {
  return {
    numero: '', serie: '', banco: '', monto: 0, moneda: 'ARS',
    fechaEmision: '', fechaVencimiento: '', tipo: 'al_dia',
    alPortador: false, endosado: false, endosadoPor: '', dniEndosante: '',
    librador: '', cuitLibrador: '', recibidoDe: '', entregadoA: '',
    estado: 'en_cartera', observaciones: '',
  };
}

/* ─── Modal ──────────────────────────────────────────────────────────────── */

const iCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ChequeModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Omit<Cheque, 'id' | 'createdAt'> | null;
  onSave: (data: Omit<Cheque, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<Cheque, 'id' | 'createdAt'>>(initial ?? emptyForm());

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ backgroundColor: '#262e63' }}>
          <h2 className="font-semibold text-white">{initial ? 'Editar cheque' : 'Nuevo cheque'}</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Datos del cheque */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Datos del cheque</p>
          <div className="grid grid-cols-2 gap-4">
            <FL label="Número de cheque *">
              <input className={iCls} value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="000000" />
            </FL>
            <FL label="Serie (opcional)">
              <input className={iCls} value={form.serie} onChange={e => set('serie', e.target.value)} placeholder="Ej: A, B, 001..." />
            </FL>
            <FL label="Banco emisor *">
              <input className={iCls} value={form.banco} onChange={e => set('banco', e.target.value)} placeholder="Ej: Santander" />
            </FL>
            <FL label="Monto *">
              <input className={iCls} type="number" min="0" value={form.monto || ''} onChange={e => set('monto', parseFloat(e.target.value) || 0)} placeholder="0" />
            </FL>
            <FL label="Moneda">
              <select className={iCls} value={form.moneda} onChange={e => set('moneda', e.target.value as Moneda)}>
                <option value="ARS">Pesos (ARS)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </FL>
            <FL label="Fecha de emisión">
              <input className={iCls} type="date" value={form.fechaEmision} onChange={e => set('fechaEmision', e.target.value)} />
            </FL>
            <FL label="Fecha de vencimiento *">
              <input className={iCls} type="date" value={form.fechaVencimiento} onChange={e => set('fechaVencimiento', e.target.value)} />
            </FL>
            <FL label="Tipo">
              <select className={iCls} value={form.tipo} onChange={e => set('tipo', e.target.value as Tipo)}>
                <option value="al_dia">Al día</option>
                <option value="diferido">Diferido</option>
              </select>
            </FL>
            <FL label="Estado">
              <select className={iCls} value={form.estado} onChange={e => set('estado', e.target.value as Estado)}>
                <option value="en_cartera">En cartera</option>
                <option value="depositado">Depositado</option>
                <option value="entregado">Entregado</option>
                <option value="cobrado">Cobrado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </FL>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={form.alPortador} onChange={e => set('alPortador', e.target.checked)} className="rounded border-gray-300 text-blue-500" />
              Al portador
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={form.endosado} onChange={e => set('endosado', e.target.checked)} className="rounded border-gray-300 text-blue-500" />
              Endosado
            </label>
          </div>

          {/* Datos del endoso (solo si endosado=true) */}
          {form.endosado && (
            <div className="grid grid-cols-2 gap-4">
              <FL label="Endosado por (quién lo firmó al dorso)">
                <input className={iCls} value={form.endosadoPor} onChange={e => set('endosadoPor', e.target.value)} placeholder="Nombre del endosante" />
              </FL>
              <FL label="DNI / CUIT del endosante">
                <input className={iCls} value={form.dniEndosante} onChange={e => set('dniEndosante', e.target.value)} placeholder="20-12345678-9" />
              </FL>
            </div>
          )}

          {/* Personas */}
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider border-t border-gray-100 pt-4">Personas</p>
          <div className="grid grid-cols-2 gap-4">
            <FL label="Librador (quién firmó el cheque) *">
              <input className={iCls} value={form.librador} onChange={e => set('librador', e.target.value)} placeholder="Nombre del firmante" />
            </FL>
            <FL label="CUIT del librador">
              <input className={iCls} value={form.cuitLibrador} onChange={e => set('cuitLibrador', e.target.value)} placeholder="20-12345678-9" />
            </FL>
            <FL label="Recibido de (quién nos lo entregó) *">
              <input className={iCls} value={form.recibidoDe} onChange={e => set('recibidoDe', e.target.value)} placeholder="Nombre o empresa" />
            </FL>
            <FL label="Entregado a (si lo cedimos a alguien)">
              <input className={iCls} value={form.entregadoA} onChange={e => set('entregadoA', e.target.value)} placeholder="Nombre o empresa" />
            </FL>
          </div>

          {/* Observaciones */}
          <FL label="Observaciones">
            <textarea className={iCls + ' resize-none'} rows={2} value={form.observaciones} onChange={e => set('observaciones', e.target.value)} placeholder="Notas adicionales..." />
          </FL>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => {
              if (!form.numero || !form.banco || !form.monto || !form.fechaVencimiento || !form.librador || !form.recibidoDe) {
                alert('Completá los campos obligatorios (*)');
                return;
              }
              onSave(form);
            }}
            className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors"
            style={{ backgroundColor: '#262e63' }}
          >
            {initial ? 'Guardar cambios' : 'Agregar cheque'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Exports ────────────────────────────────────────────────────────────── */

interface PdfOptions {
  title: string;
  subtitle?: string;
  isConstancia?: boolean;
}

function exportPDF(cheques: Cheque[], opts: PdfOptions) {
  const doc = new jsPDF('landscape');
  const navy: [number, number, number] = [38, 46, 99];
  const today = new Date().toLocaleDateString('es-AR');

  // Header
  doc.setFillColor(38, 46, 99);
  doc.rect(0, 0, 297, opts.subtitle ? 28 : 22, 'F');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(opts.title, 14, 14);
  if (opts.subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(opts.subtitle, 14, 23);
  }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${today}`, 250, 14);

  const startY = opts.subtitle ? 34 : 28;

  // Totals by currency
  const totalARS = cheques.filter(c => c.moneda === 'ARS').reduce((s, c) => s + c.monto, 0);
  const totalUSD = cheques.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0);

  const columns = opts.isConstancia
    ? ['N° Cheque', 'Banco', 'Monto', 'Vto.', 'Librador', 'CUIT Librador', 'Endosado por', 'Estado', 'Obs.']
    : ['N° Cheque', 'Banco', 'Monto', 'Emisión', 'Vto.', 'Tipo', 'Librador', 'Recibido de', 'Entregado a', 'Endosado por', 'Estado'];

  const rows = cheques.map((c) =>
    opts.isConstancia
      ? [c.numero, c.banco, $$(c.monto, c.moneda), fmtDate(c.fechaVencimiento),
         c.librador, c.cuitLibrador || '-', c.endosado ? (c.endosadoPor || 'Sí') : 'No',
         estadoLabel[c.estado], c.observaciones || '-']
      : [c.numero, c.banco, $$(c.monto, c.moneda), fmtDate(c.fechaEmision), fmtDate(c.fechaVencimiento),
         c.tipo === 'al_dia' ? 'Al día' : 'Diferido', c.librador, c.recibidoDe,
         c.entregadoA || '-', c.endosado ? (c.endosadoPor || 'Sí') : 'No', estadoLabel[c.estado]]
  );

  autoTable(doc, {
    startY,
    head: [columns],
    body: rows,
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: navy },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    margin: { left: 10, right: 10 },
  });

  // Footer totals
  const finalY = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  let footerText = `Total: ${cheques.length} cheque${cheques.length !== 1 ? 's' : ''}`;
  if (totalARS > 0) footerText += `   |   Total ARS: ${$$(totalARS)}`;
  if (totalUSD > 0) footerText += `   |   Total USD: ${$$(totalUSD, 'USD')}`;
  doc.text(footerText, 14, finalY);

  if (opts.isConstancia) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Maja Automotores — Documento generado automáticamente', 14, finalY + 7);
  }

  const filename = opts.isConstancia
    ? `constancia-cheques-${today.replace(/\//g, '-')}.pdf`
    : `cheques-${today.replace(/\//g, '-')}.pdf`;

  doc.save(filename);
}

function exportExcel(cheques: Cheque[]) {
  const rows = cheques.map((c) => ({
    'N° Cheque': c.numero,
    'Banco': c.banco,
    'Monto': c.monto,
    'Moneda': c.moneda,
    'Fecha Emisión': fmtDate(c.fechaEmision),
    'Fecha Vencimiento': fmtDate(c.fechaVencimiento),
    'Tipo': c.tipo === 'al_dia' ? 'Al día' : 'Diferido',
    'Al portador': c.alPortador ? 'Sí' : 'No',
    'Endosado': c.endosado ? 'Sí' : 'No',
    'Endosado por': c.endosadoPor,
    'Librador': c.librador,
    'CUIT Librador': c.cuitLibrador,
    'Recibido de': c.recibidoDe,
    'Entregado a': c.entregadoA,
    'Estado': estadoLabel[c.estado],
    'Observaciones': c.observaciones,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Cheques');
  XLSX.writeFile(wb, `cheques-${new Date().toLocaleDateString('es-AR').replace(/\//g, '-')}.xlsx`);
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export function Cheques() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; editing: Cheque | null }>({ open: false, editing: null });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroMoneda, setFiltroMoneda] = useState('');
  const [filtroRecibidoDe, setFiltroRecibidoDe] = useState('');
  const [filtroLibrador, setFiltroLibrador] = useState('');
  const [filtroDesde, setFiltroDesde] = useState('');
  const [filtroHasta, setFiltroHasta] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cheques', { headers: { Authorization: `Bearer ${getToken()}` } });
      const data = await res.json();
      setCheques(data.cheques || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(data: Omit<Cheque, 'id' | 'createdAt'>) {
    const editing = modal.editing;
    if (editing) {
      await fetch(`/api/cheques/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(data),
      });
    } else {
      await fetch('/api/cheques', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(data),
      });
    }
    setModal({ open: false, editing: null });
    load();
  }

  async function del(id: string) {
    await fetch(`/api/cheques/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
    setCheques((p) => p.filter((c) => c.id !== id));
    setDeleteId(null);
  }

  function clearFilters() {
    setSearch(''); setFiltroEstado(''); setFiltroTipo(''); setFiltroMoneda('');
    setFiltroRecibidoDe(''); setFiltroLibrador(''); setFiltroDesde(''); setFiltroHasta('');
  }

  const hasFilters = search || filtroEstado || filtroTipo || filtroMoneda || filtroRecibidoDe || filtroLibrador || filtroDesde || filtroHasta;

  const filtered = cheques.filter((c) => {
    if (filtroEstado && c.estado !== filtroEstado) return false;
    if (filtroTipo && c.tipo !== filtroTipo) return false;
    if (filtroMoneda && c.moneda !== filtroMoneda) return false;
    if (filtroRecibidoDe && c.recibidoDe !== filtroRecibidoDe) return false;
    if (filtroLibrador && c.librador !== filtroLibrador) return false;
    if (filtroDesde && c.fechaVencimiento < filtroDesde) return false;
    if (filtroHasta && c.fechaVencimiento > filtroHasta) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.numero.toLowerCase().includes(q) ||
        c.banco.toLowerCase().includes(q) ||
        c.librador.toLowerCase().includes(q) ||
        c.recibidoDe.toLowerCase().includes(q) ||
        c.entregadoA.toLowerCase().includes(q) ||
        c.endosadoPor.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Summary stats
  const enCartera = cheques.filter((c) => c.estado === 'en_cartera');
  const proxVencer = cheques.filter((c) => vencimientoAlert(c) === 'proximo');
  const vencidos = cheques.filter((c) => vencimientoAlert(c) === 'vencido');
  const totalCarteraARS = enCartera.filter(c => c.moneda === 'ARS').reduce((s, c) => s + c.monto, 0);
  const totalCarteraUSD = enCartera.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0);

  // Unique values for dropdowns
  const optsRecibidoDe = unique(cheques.map(c => c.recibidoDe));
  const optsLibrador = unique(cheques.map(c => c.librador));

  const selCls = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

  function handleExportPDF() {
    const isConstancia = !!filtroRecibidoDe;
    exportPDF(filtered, {
      title: isConstancia
        ? 'Constancia de Cheques — Maja Automotores'
        : 'Planilla de Cheques — Maja Automotores',
      subtitle: isConstancia
        ? `Cheques recibidos de: ${filtroRecibidoDe}${filtroEstado ? '  |  Estado: ' + estadoLabel[filtroEstado as Estado] : ''}${filtroDesde || filtroHasta ? `  |  Vto.: ${filtroDesde ? fmtDate(filtroDesde) : ''}${filtroHasta ? ' al ' + fmtDate(filtroHasta) : ''}` : ''}`
        : undefined,
      isConstancia,
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cheques</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control de cheques recibidos y entregados</p>
        </div>
        <button
          onClick={() => setModal({ open: true, editing: null })}
          className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl transition-colors"
          style={{ backgroundColor: '#262e63' }}
        >
          <Plus size={16} /> Nuevo cheque
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">En cartera (ARS)</p>
          <p className="text-xl font-bold text-gray-900">{$$(totalCarteraARS)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{enCartera.filter(c => c.moneda === 'ARS').length} cheques</p>
        </div>
        {totalCarteraUSD > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">En cartera (USD)</p>
            <p className="text-xl font-bold text-gray-900">{$$(totalCarteraUSD, 'USD')}</p>
            <p className="text-xs text-gray-400 mt-0.5">{enCartera.filter(c => c.moneda === 'USD').length} cheques</p>
          </div>
        )}
        <div className={`border rounded-xl p-4 ${proxVencer.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs mb-1 ${proxVencer.length > 0 ? 'text-amber-600' : 'text-gray-500'}`}>Vencen en 7 días</p>
          <p className={`text-xl font-bold ${proxVencer.length > 0 ? 'text-amber-700' : 'text-gray-900'}`}>{proxVencer.length}</p>
        </div>
        <div className={`border rounded-xl p-4 ${vencidos.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs mb-1 ${vencidos.length > 0 ? 'text-red-600' : 'text-gray-500'}`}>Vencidos sin cobrar</p>
          <p className={`text-xl font-bold ${vencidos.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>{vencidos.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className={selCls + ' min-w-[200px]'}
            placeholder="Buscar número, banco, librador..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className={selCls} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="en_cartera">En cartera</option>
            <option value="depositado">Depositado</option>
            <option value="entregado">Entregado</option>
            <option value="cobrado">Cobrado</option>
            <option value="rechazado">Rechazado</option>
          </select>
          <select className={selCls} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Al día + Diferido</option>
            <option value="al_dia">Al día</option>
            <option value="diferido">Diferido</option>
          </select>
          <select className={selCls} value={filtroMoneda} onChange={e => setFiltroMoneda(e.target.value)}>
            <option value="">ARS + USD</option>
            <option value="ARS">Solo Pesos</option>
            <option value="USD">Solo Dólares</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select className={selCls + ' min-w-[180px]'} value={filtroRecibidoDe} onChange={e => setFiltroRecibidoDe(e.target.value)}>
            <option value="">Recibido de: todos</option>
            {optsRecibidoDe.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <select className={selCls + ' min-w-[180px]'} value={filtroLibrador} onChange={e => setFiltroLibrador(e.target.value)}>
            <option value="">Librador: todos</option>
            {optsLibrador.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">Vto. desde</span>
            <input type="date" className={selCls} value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">hasta</span>
            <input type="date" className={selCls} value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-gray-400 hover:text-red-500 transition-colors underline">
              Limpiar filtros
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={handleExportPDF} disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
              <FileDown size={15} />
              {filtroRecibidoDe ? 'Constancia PDF' : 'PDF'}
            </button>
            <button onClick={() => exportExcel(filtered)} disabled={filtered.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
              <TableIcon size={15} /> Excel
            </button>
          </div>
        </div>
        {filtroRecibidoDe && (
          <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5">
            El PDF se generará como <strong>constancia</strong> para <strong>{filtroRecibidoDe}</strong> con los {filtered.length} cheque{filtered.length !== 1 ? 's' : ''} filtrados.
          </p>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ChevronDown size={36} className="mx-auto mb-3 opacity-30" />
          <p>{cheques.length === 0 ? 'No hay cheques cargados' : 'No hay resultados para los filtros aplicados'}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#262e63' }}>
                  {['N° Cheque', 'Banco', 'Monto', 'Emisión', 'Vencimiento', 'Tipo', 'Librador', 'Endosado por', 'Recibido de', 'Entregado a', 'Estado', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-white font-medium text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const alert = vencimientoAlert(c);
                  const days = daysUntil(c.fechaVencimiento);
                  return (
                    <tr key={c.id} className={`border-b border-gray-100 transition-colors hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 font-mono font-medium text-gray-900">{c.numero}</td>
                      <td className="px-4 py-3 text-gray-700">{c.banco}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{$$(c.monto, c.moneda)}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmtDate(c.fechaEmision)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {alert === 'vencido' && <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />}
                          {alert === 'proximo' && <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />}
                          <span className={alert === 'vencido' ? 'text-red-600 font-medium' : alert === 'proximo' ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                            {fmtDate(c.fechaVencimiento)}
                          </span>
                        </div>
                        {alert === 'vencido' && <p className="text-xs text-red-400 mt-0.5">Hace {Math.abs(days!)} días</p>}
                        {alert === 'proximo' && <p className="text-xs text-amber-400 mt-0.5">En {days} días</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.tipo === 'diferido' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                          {c.tipo === 'al_dia' ? 'Al día' : 'Diferido'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[130px] truncate">{c.librador || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate text-xs">
                        {c.endosado
                          ? <span className="text-teal-700">{c.endosadoPor || 'Sí'}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[130px] truncate">{c.recibidoDe || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{c.entregadoA || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${estadoColor[c.estado]}`}>
                          {estadoLabel[c.estado]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {deleteId === c.id ? (
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <span className="text-xs text-gray-500 mr-1">¿Eliminar?</span>
                            <button onClick={() => del(c.id)}
                              className="px-2 py-1 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-600 text-white transition-colors">
                              Sí
                            </button>
                            <button onClick={() => setDeleteId(null)}
                              className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={() => setModal({ open: true, editing: c })}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setDeleteId(c.id)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
            <span>
              {filtered.length} cheque{filtered.length !== 1 ? 's' : ''}
              {hasFilters ? ` (filtrado de ${cheques.length} total)` : ''}
            </span>
            <span>
              {filtered.filter(c => c.moneda === 'ARS').length > 0 && (
                <span>ARS: {$$(filtered.filter(c => c.moneda === 'ARS').reduce((s, c) => s + c.monto, 0))}</span>
              )}
              {filtered.filter(c => c.moneda === 'USD').length > 0 && (
                <span className="ml-4">USD: {$$(filtered.filter(c => c.moneda === 'USD').reduce((s, c) => s + c.monto, 0), 'USD')}</span>
              )}
            </span>
          </div>
        </div>
      )}

      {modal.open && (
        <ChequeModal
          initial={modal.editing}
          onSave={save}
          onClose={() => setModal({ open: false, editing: null })}
        />
      )}
    </div>
  );
}
