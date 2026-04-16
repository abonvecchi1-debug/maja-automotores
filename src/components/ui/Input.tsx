import { clsx } from 'clsx';
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={clsx(
          'w-full px-3 py-2 text-sm border rounded-lg bg-white text-slate-900 placeholder-slate-400',
          'focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-colors duration-150',
          error ? 'border-red-400' : 'border-slate-300',
          'disabled:bg-slate-50 disabled:text-slate-500',
          className,
        )}
      />
      {hint && !error && <p className="text-xs text-slate-400">{hint}</p>}
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
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={3}
        {...props}
        className={clsx(
          'w-full px-3 py-2 text-sm border rounded-lg bg-white text-slate-900 placeholder-slate-400',
          'focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-colors duration-150 resize-none',
          error ? 'border-red-400' : 'border-slate-300',
          className,
        )}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
