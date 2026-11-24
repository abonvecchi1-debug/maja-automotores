import { useEffect } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
}

const sizeMap = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/35 backdrop-blur-md"
        onClick={onClose}
      />
      {/* Dialog — bottom sheet on mobile, centered on sm+ */}
      <div className={clsx(
        'relative w-full flex flex-col glass-strong',
        'rounded-t-[28px] sm:rounded-[28px]',
        'max-h-[92vh] sm:max-h-[90vh]',
        sizeMap[size],
      )}>
        {/* Handle bar (mobile) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-300" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-slate-900/[0.06]">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 bg-slate-900/[0.06] hover:bg-slate-900/10 hover:text-slate-800 transition-colors"
          >
            <X size={16} strokeWidth={2.4} />
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {children}
        </div>
        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 sm:px-6 border-t border-slate-900/[0.06] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
