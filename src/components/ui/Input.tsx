import { clsx } from 'clsx';
import type { InputHTMLAttributes, TextareaHTMLAttributes, FocusEvent } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

// Estilo compartido de los campos (inputs, textareas y selects): vidrio claro, bordes suaves.
export const fieldClass =
  'w-full px-3.5 py-2.5 text-sm border rounded-xl bg-white/70 text-slate-900 placeholder-slate-400 ' +
  'focus:bg-white focus:ring-4 focus:ring-brand-600/15 focus:border-brand-600 transition-all duration-150';

export function Input({ label, error, hint, className, id, type, onFocus, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  // En campos numéricos, seleccionar el contenido al enfocar: así escribís el monto
  // directo y reemplaza el "0" en vez de quedar "0123".
  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    if (type === 'number') e.target.select();
    onFocus?.(e);
  };
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        onFocus={handleFocus}
        {...props}
        className={clsx(
          fieldClass,
          error ? 'border-red-400' : 'border-slate-300/70',
          'disabled:bg-slate-100/60 disabled:text-slate-500',
          className,
        )}
      />
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-semibold text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={3}
        {...props}
        className={clsx(
          fieldClass,
          'resize-none',
          error ? 'border-red-400' : 'border-slate-300/70',
          className,
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
