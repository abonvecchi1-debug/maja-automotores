import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';

interface SyncState {
  online: boolean;
  syncing: boolean;
  lastSync: string | null;
  configured: boolean;
  error: string | null;
}

export function SyncStatus() {
  const [state, setState] = useState<SyncState | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('maja-auth-token');
    const poll = async () => {
      try {
        const res = await fetch('/api/sync/status', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setState(await res.json());
      } catch {}
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  }, []);

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
