import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Save, Check } from 'lucide-react';

const TOKEN_KEY = 'maja-auth-token';
const getToken = () => localStorage.getItem(TOKEN_KEY);

interface SyncConfig {
  renderUrl: string;
  lastSync: string | null;
  syncKey: string;
}

interface SyncStatus {
  online: boolean;
  syncing: boolean;
  lastSync: string | null;
  configured: boolean;
  error: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return 'Nunca';
  return new Date(iso).toLocaleString('es-AR');
}

export function SyncSettings() {
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [renderUrl, setRenderUrl] = useState('');
  const [syncKey, setSyncKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function loadConfig() {
    const res = await fetch('/api/sync/config', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) {
      const data: SyncConfig = await res.json();
      setConfig(data);
      setRenderUrl(data.renderUrl);
      setSyncKey(data.syncKey);
    }
  }

  async function loadStatus() {
    const res = await fetch('/api/sync/status', {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (res.ok) setStatus(await res.json());
  }

  useEffect(() => {
    loadConfig();
    loadStatus();
    const id = setInterval(loadStatus, 8000);
    return () => clearInterval(id);
  }, []);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/sync/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ renderUrl, syncKey }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadConfig();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setError('');
    try {
      const res = await fetch('/api/sync/now', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!data.ok) setError(data.reason || 'Sin conexión');
      await loadStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }


  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sincronización</h1>
        <p className="text-sm text-gray-500 mt-0.5">Conectá la app de escritorio con tu instancia en Render</p>
      </div>

      {/* Status card */}
      <div className={`border rounded-xl p-4 flex items-center gap-4 ${
        status?.configured
          ? status.online
            ? 'bg-green-50 border-green-200'
            : 'bg-red-50 border-red-200'
          : 'bg-gray-50 border-gray-200'
      }`}>
        {status?.syncing ? (
          <RefreshCw size={20} className="text-blue-500 animate-spin flex-shrink-0" />
        ) : status?.online ? (
          <Cloud size={20} className="text-green-600 flex-shrink-0" />
        ) : (
          <CloudOff size={20} className="text-red-500 flex-shrink-0" />
        )}
        <div>
          <p className="font-medium text-sm text-gray-900">
            {!status?.configured
              ? 'No configurado'
              : status.syncing
              ? 'Sincronizando...'
              : status.online
              ? 'Conectado a Render'
              : 'Sin conexión a Render'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Última sincronización: {fmtDate(status?.lastSync ?? null)}
          </p>
          {status?.error && (
            <p className="text-xs text-red-500 mt-0.5">{status.error}</p>
          )}
        </div>
        {status?.configured && (
          <button
            onClick={handleSyncNow}
            disabled={syncing}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            Sincronizar ahora
          </button>
        )}
      </div>

      {/* Render URL */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">URL de Render</h2>
        <p className="text-sm text-gray-500">
          Ingresá la URL de tu app en Render (ej: <code className="bg-gray-100 px-1 rounded">https://maja-automotores.onrender.com</code>)
        </p>
        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={renderUrl}
            onChange={e => setRenderUrl(e.target.value)}
            placeholder="https://tu-app.onrender.com"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#262e63' }}
          >
            {saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      {/* Sync Key */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-800">Clave de sincronización</h2>
        <p className="text-sm text-gray-500">
          Ingresá la misma clave que configuraste en Render como variable de entorno <code className="bg-gray-100 px-1 rounded">SYNC_API_KEY</code>. Todas las PCs deben usar la misma clave.
        </p>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
          value={syncKey}
          onChange={e => setSyncKey(e.target.value)}
          placeholder="Clave secreta definida en Render"
          type="password"
        />
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 space-y-1">
          <p className="font-semibold">Pasos para activar la sincronización:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>En Render → tu servicio → Environment → agregá <code className="bg-amber-100 px-1 rounded">SYNC_API_KEY</code> con cualquier clave secreta y hacé redeploy</li>
            <li>En cada PC: ingresá la URL de Render y esa misma clave acá arriba, y guardá</li>
            <li>La app va a sincronizar automáticamente cuando haya internet</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
