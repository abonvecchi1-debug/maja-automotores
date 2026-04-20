import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Loader2, FileImage, X, Trash2, FileDown, TableIcon, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TOKEN_KEY = 'maja-auth-token';
const getToken = () => localStorage.getItem(TOKEN_KEY);

interface CreditPlan {
  nombre: string;
  plazo_meses: number;
  tna: number;
  quebranto: number;
  maximo_capital: number;
  cuota_por_mil: number;
  observaciones?: string;
}

interface Campaign {
  id: string;
  titulo: string;
  emisor: string;
  modelo: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  planes: CreditPlan[];
  condiciones_generales: string[];
  seguro: string;
  identificacion_sistema: string[];
  notas: string;
  explicacion: string;
  created_at: string;
}

function fmt(n: number | undefined) {
  if (n == null) return '-';
  return n.toLocaleString('es-AR');
}

function PlanTable({ planes }: { planes: CreditPlan[] }) {
  return (
    <div className="overflow-x-auto mt-3">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">Plazo</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">TNA</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">Quebranto</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">Máx. Capital</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-600 border border-gray-200">Cuota/$1.000</th>
          </tr>
        </thead>
        <tbody>
          {planes.map((p, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-3 py-2 border border-gray-200 font-medium">{p.plazo_meses}m</td>
              <td className="px-3 py-2 border border-gray-200">{p.tna}%</td>
              <td className="px-3 py-2 border border-gray-200">{p.quebranto}%</td>
              <td className="px-3 py-2 border border-gray-200">${fmt(p.maximo_capital)}</td>
              <td className="px-3 py-2 border border-gray-200">${p.cuota_por_mil}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CampaignCard({ c, onDelete }: { c: Campaign; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={() => setOpen(!open)}>
        <div className="min-w-0">
          <p className="font-semibold text-gray-800 truncate">{c.titulo || 'Sin título'}</p>
          <p className="text-xs text-gray-500">{c.emisor} · {c.modelo} · {c.vigencia_desde} → {c.vigencia_hasta}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
          <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={15} />
          </button>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 space-y-4">
          {c.planes.length > 0 && <PlanTable planes={c.planes} />}
          {c.explicacion && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Explicación</p>
              <p className="text-sm text-blue-900 leading-relaxed whitespace-pre-line">{c.explicacion}</p>
            </div>
          )}
          {c.notas && <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{c.notas}</p>}
        </div>
      )}
    </div>
  );
}

function exportPDF(campaigns: Campaign[], from: string, to: string) {
  const doc = new jsPDF();
  const label = from && to ? `${from} al ${to}` : 'Todas las fechas';

  doc.setFontSize(18);
  doc.text('Historial de Campañas de Crédito', 14, 20);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Período: ${label}`, 14, 28);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')}`, 14, 34);

  let y = 42;
  campaigns.forEach((c) => {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(30);
    doc.text(c.titulo || 'Sin título', 14, y);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`${c.emisor} · ${c.modelo} · Vigencia: ${c.vigencia_desde} → ${c.vigencia_hasta}`, 14, y + 5);
    y += 12;

    if (c.planes.length > 0) {
      autoTable(doc, {
        startY: y,
        head: [['Plazo', 'TNA', 'Quebranto', 'Máx. Capital', 'Cuota/$1.000']],
        body: c.planes.map((p) => [
          `${p.plazo_meses}m`,
          `${p.tna}%`,
          `${p.quebranto}%`,
          `$${fmt(p.maximo_capital)}`,
          `$${p.cuota_por_mil}`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [38, 46, 99] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }
  });

  doc.save(`creditos-${from || 'todos'}-${to || ''}.pdf`);
}

function exportExcel(campaigns: Campaign[], from: string, to: string) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Campañas
  const campRows = campaigns.map((c) => ({
    'Título': c.titulo,
    'Emisor': c.emisor,
    'Modelo': c.modelo,
    'Vigencia Desde': c.vigencia_desde,
    'Vigencia Hasta': c.vigencia_hasta,
    'Seguro': c.seguro,
    'Notas': c.notas,
    'Fecha Carga': new Date(c.created_at).toLocaleDateString('es-AR'),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(campRows), 'Campañas');

  // Sheet 2: Planes
  const planRows: object[] = [];
  campaigns.forEach((c) => {
    c.planes.forEach((p) => {
      planRows.push({
        'Campaña': c.titulo,
        'Emisor': c.emisor,
        'Modelo': c.modelo,
        'Plan': p.nombre,
        'Plazo (meses)': p.plazo_meses,
        'TNA (%)': p.tna,
        'Quebranto (%)': p.quebranto,
        'Máx. Capital ($)': p.maximo_capital,
        'Cuota por $1.000': p.cuota_por_mil,
        'Observaciones': p.observaciones || '',
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planRows), 'Planes');

  const label = from && to ? `${from}_${to}` : 'todos';
  XLSX.writeFile(wb, `creditos-${label}.xlsx`);
}

export function Credits() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const loadCampaigns = useCallback(async (f?: string, t?: string) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      if (f) params.set('from', f);
      if (t) params.set('to', t);
      const res = await fetch(`/api/credits?${params}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  function handleFile(f: File) {
    setFile(f);
    setSavedId(null);
    setError(null);
    setPreview(URL.createObjectURL(f));
  }

  function handleClear() {
    setFile(null);
    setPreview(null);
    setSavedId(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/credits/analyze', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al analizar');
      setSavedId(data.id);
      loadCampaigns(from, to);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar la imagen.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteCampaign(id: string) {
    await fetch(`/api/credits/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  }

  function applyFilter() { loadCampaigns(from, to); }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Créditos y Campañas</h1>
        <p className="text-gray-500 text-sm mt-1">Subí una foto de una campaña de financiamiento para analizarla y guardarla automáticamente.</p>
      </div>

      {/* Upload */}
      {!file ? (
        <div onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all">
          <FileImage size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">Arrastrá la imagen acá o hacé click para seleccionar</p>
          <p className="text-gray-400 text-sm mt-1">JPG, PNG, WEBP — hasta 10MB</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
            <button onClick={handleClear} className="absolute top-3 right-3 z-10 bg-white rounded-full p-1.5 shadow hover:bg-red-50">
              <X size={16} className="text-gray-500" />
            </button>
            <img src={preview!} alt="Campaña" className="max-h-72 w-full object-contain p-4" />
          </div>

          {savedId ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
              <CheckCircle size={16} /> Analizado y guardado correctamente
            </div>
          ) : (
            <button onClick={analyze} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {loading ? 'Analizando...' : 'Analizar campaña'}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {/* History */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-4">Historial de campañas</h2>

        {/* Filter + Export */}
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={applyFilter}
            className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors">
            Filtrar
          </button>
          <div className="flex gap-2 ml-auto">
            <button onClick={() => exportPDF(campaigns, from, to)} disabled={campaigns.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
              <FileDown size={15} /> PDF
            </button>
            <button onClick={() => exportExcel(campaigns, from, to)} disabled={campaigns.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
              <TableIcon size={15} /> Excel
            </button>
          </div>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileImage size={40} className="mx-auto mb-3 opacity-40" />
            <p>No hay campañas guardadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => <CampaignCard key={c.id} c={c} onDelete={deleteCampaign} />)}
          </div>
        )}
      </div>
    </div>
  );
}
