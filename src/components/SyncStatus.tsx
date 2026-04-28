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

export function SyncStatus() {
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
          if (lastSyncRef.current !== null) loadAll();
          lastSyncRef.current = data.lastSync;
        }
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, [loadAll]);

  if (!state?.configured) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      {state.syncing ? (
        <RefreshCw size={12} className="text-blue-400 animate-spin flex-shrink-0" />
      ) : state.online ? (
        <Cloud size={12} className="text-green-400 flex-shrink-0" />
      ) : (
        <CloudOff size={12} className="text-red-400 flex-shrink-0" />
      )}
      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {state.syncing ? 'Sincronizando...' : state.online ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
