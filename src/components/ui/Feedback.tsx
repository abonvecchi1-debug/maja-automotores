import { create } from 'zustand';
import { Modal } from './Modal';
import { Button } from './Button';

/* ── Confirmación reutilizable (reemplaza window.confirm, que falla en la app empaquetada) ── */

type ConfirmOpts = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmState = {
  open: boolean;
  opts: ConfirmOpts | null;
  resolve: ((ok: boolean) => void) | null;
  request: (opts: ConfirmOpts) => Promise<boolean>;
  close: (ok: boolean) => void;
};

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  opts: null,
  resolve: null,
  request: (opts) => new Promise<boolean>((resolve) => set({ open: true, opts, resolve })),
  close: (ok) => {
    get().resolve?.(ok);
    set({ open: false, opts: null, resolve: null });
  },
}));

/** Confirmación dentro de la app. Devuelve una promesa: true si confirmó. */
export const confirmDialog = (opts: ConfirmOpts) => useConfirmStore.getState().request(opts);

/* ── Toasts (reemplaza alert) ── */

type ToastType = 'info' | 'error' | 'success';
type Toast = { id: number; message: string; type: ToastType };

type ToastState = {
  toasts: Toast[];
  push: (message: string, type: ToastType) => void;
  remove: (id: number) => void;
};

const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, type) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().remove(id), 3500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Aviso flotante (toast). type: 'info' | 'error' | 'success'. */
export const notify = (message: string, type: ToastType = 'info') => useToastStore.getState().push(message, type);

/* ── Host: se renderiza una sola vez en la app ── */

export function FeedbackHost() {
  const { open, opts, close } = useConfirmStore();
  const { toasts, remove } = useToastStore();

  const toastColor: Record<ToastType, string> = {
    info: 'bg-slate-800 text-white',
    error: 'bg-red-600 text-white',
    success: 'bg-green-600 text-white',
  };

  return (
    <>
      <Modal
        isOpen={open}
        onClose={() => close(false)}
        title={opts?.title ?? 'Confirmar'}
        footer={
          <>
            <Button variant="outline" onClick={() => close(false)}>{opts?.cancelLabel ?? 'Cancelar'}</Button>
            <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{opts?.confirmLabel ?? 'Confirmar'}</Button>
          </>
        }
      >
        <p className="text-sm text-slate-700 whitespace-pre-line">{opts?.message}</p>
      </Modal>

      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => remove(t.id)}
            className={`text-left text-sm px-4 py-3 rounded-xl shadow-lg ${toastColor[t.type]} animate-in`}
          >
            {t.message}
          </button>
        ))}
      </div>
    </>
  );
}
