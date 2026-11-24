import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={clsx(
      'glass rounded-[24px]',
      padding && 'p-6',
      className,
    )}>
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
  trend?: { value: number; label: string };
}

// Cuadradito del ícono en color liso (estilo iOS) y el número en un tono legible.
const colorMap = {
  blue:   { tile: 'bg-brand-600',  text: 'text-slate-900' },
  green:  { tile: 'bg-[#34c759]',  text: 'text-[#1a6e34]' },
  amber:  { tile: 'bg-[#ff9500]',  text: 'text-[#7a4200]' },
  red:    { tile: 'bg-[#ff3b30]',  text: 'text-[#c2000f]' },
  purple: { tile: 'bg-[#af52de]',  text: 'text-[#7a2a9e]' },
  slate:  { tile: 'bg-slate-500',  text: 'text-slate-900' },
};

export function StatCard({ title, value, subtitle, icon, color = 'blue', trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <Card className="flex flex-col gap-1 h-full">
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <span className={clsx(
            'w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 text-white [&>svg]:w-4 [&>svg]:h-4',
            c.tile,
          )}>
            {icon}
          </span>
        )}
        <p className="text-sm font-semibold text-slate-600 truncate">{title}</p>
      </div>
      <p className={clsx('text-[28px] font-bold tracking-tight mt-2 leading-tight', c.text)}>{value}</p>
      {subtitle && <p className="text-[13px] text-slate-600 mt-0.5">{subtitle}</p>}
      {trend && (
        <p className="mt-1.5">
          <span className={clsx(
            'inline-block text-xs font-semibold rounded-full px-2.5 py-1',
            trend.value >= 0 ? 'text-[#1a6e34] bg-[#34c759]/15' : 'text-[#c2000f] bg-[#ff3b30]/15',
          )}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </span>
        </p>
      )}
    </Card>
  );
}
