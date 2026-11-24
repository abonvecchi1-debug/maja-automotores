import { useState, useEffect, useRef } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { useStore } from '../store';

interface SyncState {
  online: boolean;
  syncing: boolean;
  lastSync: string | null;
  configured: boolean;
  error: string | null;
}

/** Estado de sincronización en una línea. Si no hay sync configurada muestra `fallback`. */
export function SyncStatus({ fallback }: { fallback?: string }) {
  const [state, setState] = useState<SyncState | null>(null);
  const lastSyncRef = useRef<string | null>(null);
  const loadAll = useStore((s) => s.loadAll);

  useEffect(() => {
    const token = localStorage.getItem('maja-auth-token');
    const poll = async () => {
      try {
        const res = await fetch('/api/sync/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: SyncState = await res.json();
        setState(data);
        // When lastSync changes it means new data arrived — reload the store
        if (data.lastSync && data.lastSync !== lastSyncRef.current) {
          if (lastSyncRef.current !== null) loadAll(true);
          lastSyncRef.current = data.lastSync;
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, [loadAll]);

  if (!state?.configured) {
    return fallback ? <p className="text-[13px] text-slate-500 truncate">{fallback}</p> : null;
  }

  return (
    <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
      {state.syncing ? (
        <RefreshCw size={12} className="text-brand-600 animate-spin flex-shrink-0" />
      ) : state.online ? (
        <Cloud size={12} className="text-[#34c759] flex-shrink-0" />
      ) : (
        <CloudOff size={12} className="text-[#ff3b30] flex-shrink-0" />
      )}
      {state.syncing ? 'Sincronizando…' : state.online ? 'Sincronizado' : 'Sin conexión'}
    </p>
  );
}
