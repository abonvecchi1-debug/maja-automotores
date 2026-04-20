import { useState, useRef } from 'react';
import { Upload, Loader2, FileImage, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

interface CreditPlan {
  nombre: string;
  plazo_meses: number;
  tna: number;
  quebranto: number;
  maximo_capital: number;
  cuota_por_mil: number;
  observaciones?: string;
}

interface CreditResult {
  titulo?: string;
  emisor?: string;
  vigencia?: { desde: string; hasta: string };
  modelo?: string;
  condiciones?: string;
  planes?: CreditPlan[];
  condiciones_generales?: string[];
  seguro?: string;
  identificacion_sistema?: string[];
  notas?: string;
  raw?: string;
}

function fmt(n: number | undefined) {
  if (n == null) return '-';
  return n.toLocaleString('es-AR');
}

function PlanCard({ plan }: { plan: CreditPlan }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-800 text-sm">{plan.nombre || `${plan.plazo_meses} meses`}</span>
        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
          {plan.plazo_meses}m
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">TNA</p>
          <p className="font-semibold text-gray-800">{plan.tna}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">Quebranto</p>
          <p className="font-semibold text-gray-800">{plan.quebranto}%</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">Máx. Capital</p>
          <p className="font-semibold text-gray-800">${fmt(plan.maximo_capital)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-xs text-gray-500">Cuota / $1.000</p>
          <p className="font-semibold text-gray-800">${plan.cuota_por_mil}</p>
        </div>
      </div>
      {plan.observaciones && (
        <p className="text-xs text-gray-500 italic">{plan.observaciones}</p>
      )}
    </div>
  );
}

export function Credits() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConditions, setShowConditions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const token = localStorage.getItem('maja-auth-token');

  function handleFile(f: File) {
    setFile(f);
    setResult(null);
    setError(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  function handleClear() {
    setFile(null);
    setPreview(null);
    setResult(null);
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
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al analizar');
      setResult(data.result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo analizar la imagen.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Créditos y Campañas</h1>
        <p className="text-gray-500 text-sm mt-1">Subí una foto o imagen de una campaña de financiamiento y la analizamos automáticamente.</p>
      </div>

      {/* Upload area */}
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          <FileImage size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-600 font-medium">Arrastrá la imagen acá o hacé click para seleccionar</p>
          <p className="text-gray-400 text-sm mt-1">JPG, PNG, WEBP — hasta 10MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
            <button
              onClick={handleClear}
              className="absolute top-3 right-3 z-10 bg-white rounded-full p-1.5 shadow hover:bg-red-50 transition-colors"
            >
              <X size={16} className="text-gray-500" />
            </button>
            <img src={preview!} alt="Campaña" className="max-h-80 w-full object-contain p-4" />
          </div>

          <button
            onClick={analyze}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {loading ? 'Analizando...' : 'Analizar campaña'}
          </button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {result.raw ? (
            <div className="bg-gray-50 rounded-xl p-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap">{result.raw}</pre>
            </div>
          ) : (
            <>
              {/* Header info */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
                <p className="text-blue-200 text-xs font-medium uppercase tracking-wider">{result.emisor}</p>
                <h2 className="text-xl font-bold mt-1">{result.titulo}</h2>
                {result.modelo && <p className="text-blue-100 text-sm mt-1">Modelo: {result.modelo}</p>}
                {result.vigencia && (
                  <p className="text-blue-200 text-xs mt-2">
                    Vigencia: {result.vigencia.desde} → {result.vigencia.hasta}
                  </p>
                )}
              </div>

              {/* Plans */}
              {result.planes && result.planes.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Planes disponibles</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {result.planes.map((plan, i) => <PlanCard key={i} plan={plan} />)}
                  </div>
                </div>
              )}

              {/* Conditions */}
              {result.condiciones_generales && result.condiciones_generales.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowConditions(!showConditions)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Condiciones generales
                    {showConditions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {showConditions && (
                    <ul className="px-4 pb-4 space-y-1">
                      {result.condiciones_generales.map((c, i) => (
                        <li key={i} className="text-sm text-gray-600 flex gap-2">
                          <span className="text-gray-300 mt-0.5">•</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Seguro + Sistema IDs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {result.seguro && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">Seguro</p>
                    <p className="text-sm text-amber-800">{result.seguro}</p>
                  </div>
                )}
                {result.identificacion_sistema && result.identificacion_sistema.length > 0 && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">ID Sistema Web</p>
                    <ul className="space-y-1">
                      {result.identificacion_sistema.map((id, i) => (
                        <li key={i} className="text-xs font-mono text-gray-600 bg-white border border-gray-200 rounded px-2 py-1">{id}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {result.notas && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wider mb-1">Aclaración importante</p>
                  <p className="text-sm text-yellow-800">{result.notas}</p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
