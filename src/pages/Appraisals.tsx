import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calculator, Plus, Trash2, Save, FolderOpen, Sparkles, ExternalLink, RefreshCw,
  DollarSign, ClipboardPaste, ImagePlus, AlertTriangle, FilePlus2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { clsx } from 'clsx';
import { useStore } from '../store';
import { authFetch } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { confirmDialog, notify } from '../components/ui/Feedback';
import { formatCurrency, formatDate } from '../utils/formatters';

/* ─── Tipos ─────────────────────────────────────────────────────────────── */

type Estado = 'excelente' | 'muybueno' | 'bueno' | 'regular' | 'malo';
type Velocidad = 'rapida' | 'normal' | 'calma';

interface AppraisalForm {
  marca: string; modelo: string; version: string; anio: number; km: number;
  combustible: string; traccion: string; caja: string; ubicacion: string;
  estado: Estado; velocidad: Velocidad; notas: string;
  reparaciones: number; preparacion: number; gestoria: number;
  margen: number; negociacion: number; ajKm: number; ajAnio: number; dolar: number;
}

interface Comp {
  id: string; titulo: string; anio: number; km: number; precio: number;
  moneda: 'ARS' | 'USD'; ubicacion: string; incluir: boolean;
}

interface Results {
  publicacion: number; cierre: number; costos: number; tomaMax: number;
  primeraOferta: number; ganancia: number; mediana: number; n: number;
}

interface Appraisal {
  id: string; title: string; form: AppraisalForm; comps: Comp[];
  results: Results; createdBy: string; createdAt: string;
}

/* ─── Constantes ────────────────────────────────────────────────────────── */

const DRAFT_KEY = 'maja-tasacion-borrador-v1';

const ESTADOS: Record<Estado, { label: string; pct: number }> = {
  excelente: { label: 'Excelente', pct: 5 },
  muybueno:  { label: 'Muy bueno', pct: 2 },
  bueno:     { label: 'Bueno', pct: 0 },
  regular:   { label: 'Regular', pct: -7 },
  malo:      { label: 'Malo', pct: -15 },
};

const VELOCIDADES: { value: Velocidad; label: string; hint: string }[] = [
  { value: 'rapida', label: 'Venta rápida', hint: 'Entre los más baratos del mercado' },
  { value: 'normal', label: 'Normal', hint: 'Un poco abajo del promedio' },
  { value: 'calma',  label: 'Sin apuro', hint: 'En el promedio de los avisos' },
];

const DEFAULT_FORM: AppraisalForm = {
  marca: '', modelo: '', version: '', anio: 0, km: 0,
  combustible: 'Nafta', traccion: 'Delantera', caja: 'Manual', ubicacion: '',
  estado: 'bueno', velocidad: 'normal', notas: '',
  reparaciones: 0, preparacion: 1_000_000, gestoria: 300_000,
  margen: 12, negociacion: 5, ajKm: 1.5, ajAnio: 6, dolar: 0,
};

const opts = (xs: string[]) => xs.map((x) => ({ value: x, label: x }));

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const uid = () => Math.random().toString(36).slice(2, 10);
const fmtInt = (n: number) => Math.round(n || 0).toLocaleString('es-AR');
const fmtUsd = (n: number) => 'US$ ' + fmtInt(n);
const shortM = (n: number) => '$' + (n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + 'M';
const digits = (s: string) => Number(String(s).replace(/[^\d]/g, '')) || 0;
const r50 = (n: number) => Math.round(n / 50_000) * 50_000;
const f50 = (n: number) => Math.floor(n / 50_000) * 50_000;
const pctTxt = (n: number) => String(n).replace('.', ',');

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

const vehLine = (f: AppraisalForm) =>
  [[f.marca, f.modelo, f.version].filter(Boolean).join(' '), f.anio || '', f.km ? fmtInt(f.km) + ' km' : '', f.combustible, f.traccion, f.caja]
    .filter(Boolean).join(' · ');

/** ¿El aviso se parece al auto que se tasa? Mismo modelo, año cercano y sin tracción distinta. */
function looksComparable(titulo: string, anio: number, f: AppraisalForm) {
  const t = titulo.toLowerCase();
  if (f.modelo && !t.includes(f.modelo.toLowerCase())) return false;
  if (anio && f.anio && Math.abs(anio - f.anio) > 2) return false;
  const want = f.traccion.toLowerCase();
  if ((want === '4x2' && /4x4/.test(t)) || (want === '4x4' && /4x2/.test(t))) return false;
  return true;
}

/* ─── Cálculo ───────────────────────────────────────────────────────────── */
// Cada aviso se pasa a pesos (dólar blue) y se ajusta a nuestro km y año. Sobre los
// avisos usados se toma la mediana (o el percentil 25 si se quiere vender rápido),
// se ajusta por estado y de ahí sale la publicación. La toma se calcula para atrás:
// cierre esperado − costos del auto − ganancia buscada.

function compute(f: AppraisalForm, comps: Comp[]) {
  const rows = comps.map((c) => {
    const precioArs = c.moneda === 'USD' ? c.precio * (f.dolar || 0) : c.precio;
    let factor = 1;
    if (c.km > 0 && f.km > 0) factor *= 1 - (f.ajKm / 100) * ((f.km - c.km) / 10_000);
    if (c.anio > 1950 && f.anio > 1950) factor *= 1 + (f.ajAnio / 100) * (f.anio - c.anio);
    factor = Math.min(1.4, Math.max(0.6, factor));
    return { c, precioArs, valid: precioArs > 0, adj: precioArs * factor, outlier: false };
  });
  const used = rows.filter((r) => r.valid && r.c.incluir);
  if (!used.length) return { rows, used, res: null };
  const sorted = used.map((r) => r.adj).sort((a, b) => a - b);
  const med = percentile(sorted, 0.5), p25 = percentile(sorted, 0.25);
  rows.forEach((r) => { r.outlier = r.valid && med > 0 && Math.abs(r.adj / med - 1) > 0.25; });
  const base = f.velocidad === 'rapida' ? p25 : f.velocidad === 'calma' ? med : med * 0.97;
  const estadoPct = ESTADOS[f.estado]?.pct ?? 0;
  const publicacion = r50(base * (1 + estadoPct / 100));
  const cierre = publicacion * (1 - f.negociacion / 100);
  const costos = f.reparaciones + f.preparacion + f.gestoria;
  const tomaMax = Math.max(0, f50(cierre - costos - cierre * (f.margen / 100)));
  const primeraOferta = Math.max(0, f50(tomaMax * 0.93));
  return {
    rows, used,
    res: {
      base, estadoPct, publicacion, cierre, costos, tomaMax, primeraOferta,
      ganancia: cierre - tomaMax - costos, ganancia2: cierre - primeraOferta - costos,
      med, min: sorted[0], max: sorted[sorted.length - 1], n: used.length,
    },
  };
}

/* ─── Inputs numéricos con separador de miles ───────────────────────────── */

function NumInput({ label, value, onChange, prefix, suffix, decimal, placeholder, hint }: {
  label: string; value: number; onChange: (n: number) => void;
  prefix?: string; suffix?: string; decimal?: boolean; placeholder?: string; hint?: string;
}) {
  const show = (n: number) => (n ? (decimal ? pctTxt(n) : fmtInt(n)) : '');
  const [txt, setTxt] = useState(show(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(show(value)); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  const id = 'tas-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">{prefix}</span>}
        <input
          id={id}
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={txt}
          placeholder={placeholder}
          onFocus={(e) => { focused.current = true; e.target.select(); }}
          onBlur={() => { focused.current = false; setTxt(show(value)); }}
          onChange={(e) => {
            setTxt(e.target.value);
            onChange(decimal ? (parseFloat(e.target.value.replace(',', '.')) || 0) : digits(e.target.value));
          }}
          className={clsx(
            'w-full py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 placeholder-slate-400 tabular-nums',
            'focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-colors duration-150',
            prefix ? 'pl-7' : 'pl-3', suffix ? 'pr-8' : 'pr-3',
          )}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/* Celda editable de la tabla de avisos (número con miles, se formatea al salir). */
function CellNum({ value, onChange, width, label }: { value: number; onChange: (n: number) => void; width: string; label: string }) {
  const [txt, setTxt] = useState(value ? fmtInt(value) : '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setTxt(value ? fmtInt(value) : ''); }, [value]);
  return (
    <input
      aria-label={label}
      inputMode="numeric"
      value={txt}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={() => { focused.current = false; setTxt(value ? fmtInt(value) : ''); }}
      onChange={(e) => { setTxt(e.target.value); onChange(digits(e.target.value)); }}
      className={clsx('px-2 py-1.5 text-sm rounded-md border border-transparent hover:border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600 bg-transparent tabular-nums', width)}
    />
  );
}

/* ─── Página ────────────────────────────────────────────────────────────── */

type Draft = { form: AppraisalForm; comps: Comp[] };

const loadDraft = (): Draft | null => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (d && d.form && Array.isArray(d.comps)) return { form: { ...DEFAULT_FORM, ...d.form }, comps: d.comps };
  } catch { /* sin borrador */ }
  return null;
};

export function Appraisals() {
  const { vehicles } = useStore();
  const initial = useMemo(loadDraft, []);
  const [form, setForm] = useState<AppraisalForm>(initial?.form ?? DEFAULT_FORM);
  const [comps, setComps] = useState<Comp[]>(initial?.comps ?? []);
  const [blue, setBlue] = useState<{ venta: number; fuente: string } | null>(null);
  const [blueLoading, setBlueLoading] = useState(false);
  const [history, setHistory] = useState<Appraisal[]>([]);
  const [saving, setSaving] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteFiles, setPasteFiles] = useState<File[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const [opinion, setOpinion] = useState<string | null>(null);
  const [opinionLoading, setOpinionLoading] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof AppraisalForm>(k: K, v: AppraisalForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Borrador local: si cerrás la app a mitad de una tasación, la encontrás igual.
  useEffect(() => {
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, comps })); } catch { /* lleno */ } }, 400);
    return () => clearTimeout(t);
  }, [form, comps]);

  const loadBlue = () => {
    setBlueLoading(true);
    fetch('/api/dolar/blue')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.venta) {
          setBlue({ venta: d.venta, fuente: d.fuente });
          setForm((f) => (f.dolar ? f : { ...f, dolar: d.venta }));
        }
      })
      .catch(() => {})
      .finally(() => setBlueLoading(false));
  };

  const loadHistory = () => {
    authFetch('/api/appraisals')
      .then((r) => (r.ok ? r.json() : { appraisals: [] }))
      .then((d) => setHistory(d.appraisals ?? []))
      .catch(() => {});
  };

  useEffect(() => { loadBlue(); loadHistory(); }, []);

  const { rows, res } = useMemo(() => compute(form, comps), [form, comps]);
  const rowById = useMemo(() => new Map(rows.map((r) => [r.c.id, r])), [rows]);

  /* ── Avisos ── */
  const updateComp = (id: string, patch: Partial<Comp>) => setComps((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const addComp = () => setComps((cs) => [...cs, {
    id: uid(), titulo: [form.marca, form.modelo, form.version].filter(Boolean).join(' '),
    anio: form.anio, km: 0, precio: 0, moneda: 'ARS', ubicacion: '', incluir: true,
  }]);
  const removeComp = (id: string) => setComps((cs) => cs.filter((c) => c.id !== id));

  const extract = async () => {
    if (!pasteText.trim() && !pasteFiles.length) { setExtractMsg({ text: 'Pegá el texto de los avisos o elegí una captura.', kind: 'err' }); return; }
    setExtracting(true); setExtractMsg(null);
    try {
      const fd = new FormData();
      fd.append('text', pasteText);
      fd.append('target', JSON.stringify(form));
      for (const f of pasteFiles) fd.append('images', f);
      const r = await fetch('/api/appraisals/extract', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('maja-auth-token')}` },
        body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudieron leer los avisos.');
      const list: (Omit<Comp, 'id' | 'incluir'> & { coincide?: boolean })[] = d.listings ?? [];
      if (!list.length) { setExtractMsg({ text: 'No encontré avisos con precio en lo que pegaste.', kind: 'err' }); return; }
      const nuevos: Comp[] = list.map((x) => ({
        id: uid(), titulo: x.titulo, anio: x.anio || 0, km: x.km || 0, precio: x.precio,
        moneda: x.moneda === 'USD' ? 'USD' : 'ARS', ubicacion: x.ubicacion || '',
        incluir: x.coincide === false ? false : looksComparable(x.titulo, x.anio, form),
      }));
      setComps((cs) => [...cs, ...nuevos]);
      const usados = nuevos.filter((x) => x.incluir).length;
      setExtractMsg({ text: `Agregué ${nuevos.length} avisos${d.method === 'ia' ? ' con la IA' : ''}. ${usados} se parecen a tu auto y quedaron tildados.`, kind: 'ok' });
      setPasteText(''); setPasteFiles([]); if (fileRef.current) fileRef.current.value = '';
    } catch (e) {
      setExtractMsg({ text: e instanceof Error ? e.message : 'No se pudieron leer los avisos.', kind: 'err' });
    } finally {
      setExtracting(false);
    }
  };

  /* ── Opinión de la IA ── */
  const askOpinion = async () => {
    if (!res) return;
    setOpinionLoading(true); setOpinion(null);
    try {
      const r = await authFetch('/api/appraisals/opinion', {
        method: 'POST',
        body: JSON.stringify({ form, comps: comps.filter((c) => c.incluir), results: res }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo consultar a la IA.');
      setOpinion(d.text || 'La IA no devolvió respuesta.');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'No se pudo consultar a la IA.', 'error');
    } finally {
      setOpinionLoading(false);
    }
  };

  /* ── Guardar / abrir / borrar ── */
  const save = async () => {
    if (!res) return;
    setSaving(true);
    try {
      const results: Results = {
        publicacion: res.publicacion, cierre: Math.round(res.cierre), costos: res.costos, tomaMax: res.tomaMax,
        primeraOferta: res.primeraOferta, ganancia: Math.round(res.ganancia), mediana: Math.round(res.med), n: res.n,
      };
      const title = [form.marca, form.modelo, form.version, form.anio || ''].filter(Boolean).join(' ') || 'Tasación sin nombre';
      const r = await authFetch('/api/appraisals', { method: 'POST', body: JSON.stringify({ title, form, comps, results }) });
      if (!r.ok) throw new Error();
      const { appraisal } = await r.json();
      setHistory((h) => [appraisal, ...h]);
      notify('Tasación guardada', 'success');
    } catch {
      notify('No se pudo guardar la tasación.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const open = (a: Appraisal) => {
    setForm({ ...DEFAULT_FORM, ...a.form });
    setComps((a.comps ?? []).map((c) => ({ ...c, id: c.id || uid() })));
    setOpinion(null); setExtractMsg(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notify('Tasación abierta', 'info');
  };

  const remove = (a: Appraisal) => {
    confirmDialog({ title: 'Eliminar tasación', message: `¿Eliminar la tasación de ${a.title}?`, confirmLabel: 'Eliminar', danger: true })
      .then(async (ok) => {
        if (!ok) return;
        const prev = history;
        setHistory((h) => h.filter((x) => x.id !== a.id));
        const r = await authFetch(`/api/appraisals/${a.id}`, { method: 'DELETE' }).catch(() => null);
        if (!r || !r.ok) { setHistory(prev); notify('No se pudo eliminar.', 'error'); }
      });
  };

  const newAppraisal = () => {
    const doIt = () => {
      setForm({ ...DEFAULT_FORM, preparacion: form.preparacion, gestoria: form.gestoria, margen: form.margen, negociacion: form.negociacion, ajKm: form.ajKm, ajAnio: form.ajAnio, dolar: blue?.venta || form.dolar });
      setComps([]); setOpinion(null); setExtractMsg(null);
    };
    if (comps.length || form.modelo) {
      confirmDialog({ title: 'Nueva tasación', message: 'Se borra lo que tenés cargado ahora. Si querés conservarlo, guardalo antes.', confirmLabel: 'Empezar de nuevo' })
        .then((ok) => ok && doIt());
    } else doIt();
  };

  const fromStock = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) return;
    setForm((f) => ({ ...f, marca: v.brand, modelo: v.model, anio: v.year || 0, km: v.km || 0 }));
  };

  /* ── Links de búsqueda ── */
  const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const links = form.marca && form.modelo ? [
    { label: 'MercadoLibre', href: `https://autos.mercadolibre.com.ar/${slug(form.marca)}/${slug(form.modelo)}/${form.anio ? form.anio + '/' : ''}` },
    { label: 'Marketplace', href: `https://www.facebook.com/marketplace/search/?query=${encodeURIComponent([form.marca, form.modelo, form.anio || ''].join(' ').trim())}` },
    { label: 'Autocosmos', href: `https://www.autocosmos.com.ar/auto/usado/${slug(form.marca)}/${slug(form.modelo)}` },
  ] : [];

  /* ── Gráfico ── */
  const chartUsed = rows.filter((r) => r.valid && r.c.km > 0 && r.c.incluir).map((r) => ({ km: r.c.km, precio: r.precioArs, titulo: r.c.titulo }));
  const chartOff = rows.filter((r) => r.valid && r.c.km > 0 && !r.c.incluir).map((r) => ({ km: r.c.km, precio: r.precioArs, titulo: r.c.titulo }));
  const chartMe = res && form.km ? [{ km: form.km, precio: res.publicacion, titulo: 'Tu precio de publicación' }] : [];

  const notices: string[] = [];
  if (res) {
    if (res.n < 3) notices.push('Hay pocos avisos. Tomá el número como orientativo y sumá más comparables.');
    const lejos = rows.filter((r) => r.outlier && r.c.incluir).length;
    if (lejos) notices.push(lejos === 1 ? 'Un aviso usado está muy lejos de la mediana: revisá si es comparable.' : `${lejos} avisos usados están muy lejos de la mediana: revisá si son comparables.`);
    if (res.tomaMax <= 0) notices.push('Con estos costos y esta ganancia no conviene tomarlo.');
    if (comps.some((c) => c.moneda === 'USD' && c.incluir) && !form.dolar) notices.push('Falta el dólar: los avisos en dólares no se están contando.');
  }

  const stock = vehicles.filter((v) => v.status !== 'vendido');

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Tasación</h1>
          <p className="text-slate-500 text-sm mt-0.5">A cuánto publicarlo, a cuánto tomarlo y cuánto te queda, según avisos parecidos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={newAppraisal}><FilePlus2 size={16} /> Nueva tasación</Button>
          <Button onClick={save} loading={saving} disabled={!res}><Save size={16} /> Guardar</Button>
        </div>
      </div>

      {/* Dólar */}
      <Card className="bg-slate-900 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl"><DollarSign size={22} className="text-emerald-300" /></div>
            <div>
              <p className="text-xs text-slate-300 font-medium">Dólar para pasar avisos en US$ a pesos {blue && <span className="text-slate-400">· blue hoy ${blue.venta.toLocaleString('es-AR')} ({blue.fuente})</span>}</p>
              <p className="text-lg font-bold">{form.dolar ? `$${form.dolar.toLocaleString('es-AR')}` : <span className="text-sm font-normal text-slate-300">{blueLoading ? 'Cargando cotización…' : 'Sin cotización: cargala a mano'}</span>}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              aria-label="Dólar a usar"
              inputMode="numeric"
              value={form.dolar ? fmtInt(form.dolar) : ''}
              onChange={(e) => set('dolar', digits(e.target.value))}
              placeholder="Dólar"
              className="w-28 px-3 py-2 text-sm rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 tabular-nums focus:ring-2 focus:ring-white/40 focus:outline-none"
            />
            {blue && blue.venta !== form.dolar && (
              <button onClick={() => set('dolar', blue.venta)} className="text-xs font-medium px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">Usar blue</button>
            )}
            <button onClick={loadBlue} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" title="Actualizar cotización">
              <RefreshCw size={16} className={blueLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* ── Columna izquierda: datos ── */}
        <div className="lg:col-span-3 space-y-5 min-w-0">
          <Card>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h3 className="font-semibold text-slate-900">El auto</h3>
              {stock.length > 0 && (
                <select
                  aria-label="Tomar datos de un vehículo del stock"
                  value=""
                  onChange={(e) => fromStock(e.target.value)}
                  className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-600 focus:ring-2 focus:ring-brand-600"
                >
                  <option value="">Tomar datos de un auto del stock…</option>
                  {stock.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} {v.year} {v.patent ? `· ${v.patent}` : ''}</option>)}
                </select>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Input label="Marca" value={form.marca} onChange={(e) => set('marca', e.target.value)} placeholder="Ford" />
              <Input label="Modelo" value={form.modelo} onChange={(e) => set('modelo', e.target.value)} placeholder="Ranger" />
              <Input label="Versión" value={form.version} onChange={(e) => set('version', e.target.value)} placeholder="XLT 3.0 TDi CD" />
              <NumInput label="Año" value={form.anio} onChange={(n) => set('anio', n)} placeholder="2010" decimal />
              <NumInput label="Kilómetros" value={form.km} onChange={(n) => set('km', n)} placeholder="300.000" />
              <Input label="Ubicación" value={form.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} placeholder="Ciudad" />
              <Select label="Combustible" value={form.combustible} onChange={(e) => set('combustible', e.target.value)} options={opts(['Nafta', 'Diésel', 'Nafta/GNC', 'Híbrido', 'Eléctrico'])} />
              <Select label="Tracción" value={form.traccion} onChange={(e) => set('traccion', e.target.value)} options={opts(['Delantera', 'Trasera', '4x2', '4x4', 'AWD'])} />
              <Select label="Caja" value={form.caja} onChange={(e) => set('caja', e.target.value)} options={opts(['Manual', 'Automática'])} />
            </div>
            {links.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {links.map((l) => (
                  <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg px-3 py-2 transition-colors">
                    Buscar en {l.label} <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold text-slate-900 mb-4">Estado y costos</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Select label="Estado general" value={form.estado} onChange={(e) => set('estado', e.target.value as Estado)}
                options={(Object.keys(ESTADOS) as Estado[]).map((k) => ({ value: k, label: `${ESTADOS[k].label} (${ESTADOS[k].pct > 0 ? '+' : ''}${ESTADOS[k].pct}%)` }))} />
              <NumInput label="Reparaciones detectadas" value={form.reparaciones} onChange={(n) => set('reparaciones', n)} prefix="$" placeholder="0" />
              <NumInput label="Preparación" value={form.preparacion} onChange={(n) => set('preparacion', n)} prefix="$" hint="Service, cubiertas, lavado" />
              <NumInput label="Gestoría y papeles" value={form.gestoria} onChange={(n) => set('gestoria', n)} prefix="$" hint="Transferencia, VTV, deudas" />
              <NumInput label="Ganancia buscada" value={form.margen} onChange={(n) => set('margen', n)} suffix="%" decimal hint="Sobre el cierre" />
              <NumInput label="Regateo esperado" value={form.negociacion} onChange={(n) => set('negociacion', n)} suffix="%" decimal />
            </div>

            <p className="text-sm font-medium text-slate-700 mt-4 mb-2">¿Qué tan rápido lo querés vender?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {VELOCIDADES.map((v) => (
                <button key={v.value} type="button" onClick={() => set('velocidad', v.value)}
                  className={clsx('text-left px-3 py-2.5 rounded-lg border-2 transition-colors',
                    form.velocidad === v.value ? 'bg-brand-50 border-brand-400' : 'bg-slate-50 border-slate-200 hover:border-slate-300')}>
                  <p className={clsx('text-sm font-medium', form.velocidad === v.value ? 'text-brand-700' : 'text-slate-700')}>{v.label}</p>
                  <p className="text-xs text-slate-500">{v.hint}</p>
                </button>
              ))}
            </div>

            <div className="mt-4">
              <Textarea label="Notas de la revisión" value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2}
                placeholder="Ej.: cubiertas al 50%, embrague firme, tren delantero hace ruido" />
            </div>

            <button type="button" onClick={() => setShowAdjust((s) => !s)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
              {showAdjust ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Ajustes de comparación
            </button>
            {showAdjust && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                <NumInput label="Por cada 10.000 km de diferencia" value={form.ajKm} onChange={(n) => set('ajKm', n)} suffix="%" decimal />
                <NumInput label="Por cada año de diferencia" value={form.ajAnio} onChange={(n) => set('ajAnio', n)} suffix="%" decimal />
              </div>
            )}
          </Card>

          {/* Avisos comparables */}
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold text-slate-900">Avisos comparables</h3>
                <p className="text-xs text-slate-500 mt-0.5">Destildá los que no se parecen. "Ajustado" lleva cada aviso a tu año y kilometraje.</p>
              </div>
              <Button size="sm" variant="outline" onClick={addComp}><Plus size={14} /> Agregar aviso</Button>
            </div>
            {comps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 uppercase tracking-wide bg-slate-50">
                      <th className="px-4 py-2 font-medium w-10">Usar</th>
                      <th className="px-2 py-2 font-medium">Aviso</th>
                      <th className="px-2 py-2 font-medium">Año</th>
                      <th className="px-2 py-2 font-medium">Km</th>
                      <th className="px-2 py-2 font-medium">Precio</th>
                      <th className="px-2 py-2 font-medium">Lugar</th>
                      <th className="px-2 py-2 font-medium text-right">Ajustado</th>
                      <th className="px-2 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {comps.map((c) => {
                      const r = rowById.get(c.id);
                      return (
                        <tr key={c.id} className={clsx('hover:bg-slate-50', !c.incluir && 'text-slate-400')}>
                          <td className="px-4 py-1.5">
                            <input type="checkbox" checked={c.incluir} onChange={(e) => updateComp(c.id, { incluir: e.target.checked })}
                              aria-label="Usar este aviso" className="w-4 h-4 rounded accent-brand-600" />
                          </td>
                          <td className="px-1 py-1.5">
                            <input aria-label="Aviso" value={c.titulo} onChange={(e) => updateComp(c.id, { titulo: e.target.value })}
                              className="w-full min-w-[180px] px-2 py-1.5 text-sm rounded-md border border-transparent hover:border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600 bg-transparent" />
                          </td>
                          <td className="px-1 py-1.5"><CellNum label="Año" value={c.anio} onChange={(n) => updateComp(c.id, { anio: n })} width="w-16" /></td>
                          <td className="px-1 py-1.5"><CellNum label="Kilómetros" value={c.km} onChange={(n) => updateComp(c.id, { km: n })} width="w-24" /></td>
                          <td className="px-1 py-1.5">
                            <div className="flex items-center">
                              <select aria-label="Moneda" value={c.moneda} onChange={(e) => updateComp(c.id, { moneda: e.target.value as 'ARS' | 'USD' })}
                                className="text-xs py-1.5 pl-1 pr-0 rounded-md border border-transparent hover:border-slate-300 bg-transparent">
                                <option value="ARS">$</option><option value="USD">US$</option>
                              </select>
                              <CellNum label="Precio" value={c.precio} onChange={(n) => updateComp(c.id, { precio: n })} width="w-28" />
                            </div>
                          </td>
                          <td className="px-1 py-1.5">
                            <input aria-label="Lugar" value={c.ubicacion} onChange={(e) => updateComp(c.id, { ubicacion: e.target.value })}
                              className="w-full min-w-[120px] px-2 py-1.5 text-sm rounded-md border border-transparent hover:border-slate-300 focus:border-brand-600 focus:ring-2 focus:ring-brand-600 bg-transparent" />
                          </td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                            {r && r.valid ? formatCurrency(r.adj) : '—'}
                            {r?.outlier && <Badge variant="warning" className="ml-1.5">lejos</Badge>}
                          </td>
                          <td className="px-2 py-1.5">
                            <button onClick={() => removeComp(c.id)} className="text-slate-300 hover:text-red-500 transition-colors" title="Quitar aviso"><Trash2 size={15} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">Todavía no hay avisos. Agregalos a mano o pegalos abajo.</p>
            )}

            {/* Pegar avisos */}
            <div className="px-6 py-5 border-t border-slate-100 space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardPaste size={16} className="text-brand-600" />
                <h4 className="text-sm font-semibold text-slate-900">Pegar avisos</h4>
              </div>
              <p className="text-xs text-slate-500">
                Abrí la búsqueda en MercadoLibre o Marketplace, seleccioná todo (Ctrl+A), copiá (Ctrl+C) y pegalo acá. También podés subir capturas de pantalla (necesita la IA configurada).
              </p>
              <Textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4} placeholder="Pegá acá el listado de avisos" aria-label="Texto de los avisos" />
              <div className="flex items-center gap-2 flex-wrap">
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => setPasteFiles(Array.from(e.target.files ?? []).slice(0, 4))} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={14} /> {pasteFiles.length ? `${pasteFiles.length} captura${pasteFiles.length > 1 ? 's' : ''}` : 'Subir capturas'}
                </Button>
                <Button size="sm" onClick={extract} loading={extracting}><Sparkles size={14} /> Leer avisos</Button>
                {extractMsg && <span className={clsx('text-xs', extractMsg.kind === 'ok' ? 'text-green-700' : 'text-red-600')}>{extractMsg.text}</span>}
              </div>
            </div>
          </Card>
        </div>

        {/* ── Columna derecha: resultado ── */}
        <div className="lg:col-span-2 lg:sticky lg:top-4 space-y-4 min-w-0">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-brand-100 rounded-xl"><Calculator size={20} className="text-brand-600" /></div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{[form.marca, form.modelo, form.version].filter(Boolean).join(' ') || 'Auto sin datos'}</p>
                <p className="text-xs text-slate-500 truncate">{vehLine(form).split(' · ').slice(1).join(' · ') || 'Cargá año y kilómetros'} · {ESTADOS[form.estado].label}</p>
              </div>
            </div>

            {res ? (
              <div className="space-y-4">
                <div className="bg-brand-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-500 font-medium">Publicalo a</p>
                  <p className="text-3xl font-bold text-brand-700 tabular-nums">{formatCurrency(res.publicacion)}</p>
                  {form.dolar > 0 && <p className="text-xs text-slate-500">≈ {fmtUsd(res.publicacion / form.dolar)} al dólar de ${fmtInt(form.dolar)}</p>}
                </div>

                <div className="divide-y divide-slate-100 text-sm">
                  {[
                    { l: 'Cierre esperado', s: `después de ${pctTxt(form.negociacion)}% de regateo`, v: formatCurrency(res.cierre) },
                    { l: 'Toma máxima', s: 'no pagues más que esto', v: formatCurrency(res.tomaMax), strong: true },
                    { l: 'Primera oferta', s: 'para tener margen de regateo', v: formatCurrency(res.primeraOferta) },
                    { l: 'Costos del auto', s: 'reparación, preparación y papeles', v: formatCurrency(res.costos) },
                  ].map((x) => (
                    <div key={x.l} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0"><p className={clsx('text-slate-900', x.strong && 'font-semibold')}>{x.l}</p><p className="text-xs text-slate-400">{x.s}</p></div>
                      <p className={clsx('tabular-nums whitespace-nowrap', x.strong ? 'font-bold text-slate-900 text-base' : 'font-medium text-slate-700')}>{x.v}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <p className="text-slate-900">Ganancia con la toma máxima</p>
                    <p className="font-bold text-green-700 tabular-nums whitespace-nowrap">
                      {formatCurrency(res.ganancia)} <span className="text-xs font-medium text-green-600">({res.tomaMax ? Math.round((res.ganancia / res.tomaMax) * 100) : 0}%)</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2.5">
                    <p className="text-slate-900">Si aceptan la primera oferta</p>
                    <p className="font-bold text-green-700 tabular-nums whitespace-nowrap">{formatCurrency(res.ganancia2)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[['Avisos', String(res.n)], ['Mínimo', shortM(res.min)], ['Mediana', shortM(res.med)], ['Máximo', shortM(res.max)]].map(([k, v]) => (
                    <div key={k} className="bg-slate-50 rounded-lg px-2 py-2 min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">{k}</p>
                      <p className="text-sm font-semibold text-slate-800 tabular-nums truncate">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 -mt-2">Valores ajustados a tu año y kilometraje.</p>

                {notices.length > 0 && (
                  <div className="flex gap-2 bg-amber-50 text-amber-800 rounded-lg px-3 py-2 text-xs">
                    <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                    <p>{notices.join(' ')}</p>
                  </div>
                )}

                {(chartUsed.length + chartOff.length) >= 2 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Precio de los avisos según kilómetros</p>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                          <XAxis type="number" dataKey="km" name="Km" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} domain={['auto', 'auto']} />
                          <YAxis type="number" dataKey="precio" name="Precio" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={shortM} width={48} domain={['auto', 'auto']} />
                          <Tooltip
                            cursor={{ strokeDasharray: '3 3' }}
                            content={({ payload }) => {
                              const p = payload?.[0]?.payload as { km: number; precio: number; titulo: string } | undefined;
                              if (!p) return null;
                              return (
                                <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
                                  <p className="font-medium text-slate-900">{p.titulo}</p>
                                  <p className="text-slate-500">{fmtInt(p.km)} km · {formatCurrency(p.precio)}</p>
                                </div>
                              );
                            }}
                          />
                          {form.km > 0 && <ReferenceLine x={form.km} stroke="#262e63" strokeDasharray="4 4" />}
                          <Scatter data={chartOff} fill="#ffffff" stroke="#94a3b8" />
                          <Scatter data={chartUsed} fill="#7b83b1" />
                          <Scatter data={chartMe} fill="#262e63" shape="diamond" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mt-1">
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-brand-300" /> Aviso usado</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-slate-400" /> Descartado</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rotate-45 bg-brand-600" /> Tu precio</span>
                    </div>
                  </div>
                )}

                <button type="button" onClick={() => setShowExplain((s) => !s)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700">
                  {showExplain ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Cómo se calcula
                </button>
                {showExplain && (
                  <ol className="list-decimal pl-5 space-y-1 text-xs text-slate-500">
                    <li>Cada aviso se pasa a pesos con el dólar a ${fmtInt(form.dolar)} y se ajusta {pctTxt(form.ajKm)}% por cada 10.000 km y {pctTxt(form.ajAnio)}% por año de diferencia.</li>
                    <li>Con {res.n} avisos, la base es {form.velocidad === 'rapida' ? 'el percentil 25 (los más baratos)' : form.velocidad === 'calma' ? 'la mediana' : 'la mediana menos 3%'}: {formatCurrency(res.base)}.</li>
                    <li>Por estado {ESTADOS[form.estado].label.toLowerCase()} se ajusta {res.estadoPct > 0 ? '+' : ''}{res.estadoPct}% y se redondea a 50.000.</li>
                    <li>Cierre = publicación menos {pctTxt(form.negociacion)}% de regateo.</li>
                    <li>Toma máxima = cierre − costos − {pctTxt(form.margen)}% de ganancia, redondeada para abajo.</li>
                    <li>Primera oferta = toma máxima menos 7%.</li>
                  </ol>
                )}

                <div className="flex gap-2 pt-1">
                  <Button className="flex-1" onClick={save} loading={saving}><Save size={16} /> Guardar tasación</Button>
                  <Button variant="secondary" onClick={askOpinion} loading={opinionLoading} title="Pedir opinión a la IA"><Sparkles size={16} /> Opinión IA</Button>
                </div>
                {opinion && <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700 whitespace-pre-line">{opinion}</div>}
              </div>
            ) : (
              <p className="py-8 text-sm text-slate-400 text-center">Cargá al menos un aviso con precio para calcular.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Historial */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-900">Tasaciones guardadas</h3>
        </div>
        {history.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {history.map((a) => (
              <div key={a.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 flex-wrap sm:flex-nowrap">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-100">
                  <Calculator size={17} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{a.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(a.createdAt)}{a.form?.km ? ` · ${fmtInt(a.form.km)} km` : ''}{a.results?.n ? ` · ${a.results.n} avisos` : ''}{a.createdBy ? ` · ${a.createdBy}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">Publicar · Toma máx.</p>
                  <p className="text-sm font-semibold text-slate-800 tabular-nums">{formatCurrency(a.results?.publicacion || 0)} · {formatCurrency(a.results?.tomaMax || 0)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => open(a)}><FolderOpen size={14} /> Abrir</Button>
                  <button onClick={() => remove(a)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors" title="Eliminar"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-6 py-8 text-sm text-slate-400 text-center">Todavía no guardaste tasaciones. Cuando termines una, tocá "Guardar".</p>
        )}
      </Card>
    </div>
  );
}
