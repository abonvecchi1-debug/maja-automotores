import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cake, X } from 'lucide-react';
import { useStore } from '../store';
import { notify } from './ui/Feedback';

export function BirthdayBanner() {
  const { clients } = useStore();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const today = new Date();
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const birthdayClients = clients.filter(
    (c) => c.birthDate && c.birthDate.slice(5) === todayMMDD
  );

  // Notificación pop-up (toast) una sola vez por día, además del banner.
  useEffect(() => {
    if (birthdayClients.length === 0) return;
    const key = `bday-toast-${today.toISOString().slice(0, 10)}`;
    if (sessionStorage.getItem(key)) return;
    const names = birthdayClients.map((c) => `${c.firstName} ${c.lastName}`).join(', ');
    notify(`🎂 Hoy cumple${birthdayClients.length > 1 ? 'n' : ''} años: ${names}. ¡No te olvides de saludar!`, 'info');
    sessionStorage.setItem(key, '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthdayClients.length]);

  if (dismissed || birthdayClients.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-amber-200 bg-amber-50 flex-shrink-0">
      <Cake size={15} className="text-amber-600 flex-shrink-0" />
      <p className="flex-1 text-sm text-amber-800">
        {birthdayClients.length === 1 ? (
          <>
            Hoy es el cumpleaños de{' '}
            <button
              onClick={() => navigate(`/clientes/${birthdayClients[0].id}`)}
              className="font-semibold underline hover:text-amber-900"
            >
              {birthdayClients[0].firstName} {birthdayClients[0].lastName}
            </button>
            . ¡No te olvides de saludarlo!
          </>
        ) : (
          <>
            Hoy cumplen años:{' '}
            {birthdayClients.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ', '}
                <button
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  className="font-semibold underline hover:text-amber-900"
                >
                  {c.firstName} {c.lastName}
                </button>
              </span>
            ))}
            . ¡No te olvides de saludarlos!
          </>
        )}
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-500 hover:text-amber-700 flex-shrink-0 transition-colors"
        title="Cerrar"
      >
        <X size={15} />
      </button>
    </div>
  );
}
