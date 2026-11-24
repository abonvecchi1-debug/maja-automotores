import { clsx } from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantMap = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-[0_6px_18px_rgba(38,46,99,0.28)]',
  secondary: 'bg-white/60 hover:bg-white/85 text-slate-900 border border-white/80 backdrop-blur-md',
  danger: 'bg-[#ff3b30] hover:bg-[#e0352b] text-white shadow-[0_6px_18px_rgba(255,59,48,0.25)]',
  ghost: 'hover:bg-white/60 text-slate-700',
  outline: 'bg-white/50 hover:bg-white/85 border border-slate-300/70 text-slate-900 backdrop-blur-md',
};

const sizeMap = {
  sm: 'px-3.5 py-1.5 text-xs gap-1.5',
  md: 'px-[18px] py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
};

export function Button({
  children, variant = 'primary', size = 'md',
  loading, className, disabled, ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center font-semibold rounded-full transition-all duration-150 active:scale-[0.98]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variantMap[variant],
        sizeMap[size],
        className,
      )}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
