import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div className={clsx(
      'bg-white rounded-xl shadow-sm border border-slate-200',
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

const colorMap = {
  blue:   { bg: 'bg-brand-50',   icon: 'bg-brand-100 text-brand-600',   text: 'text-brand-600' },
  green:  { bg: 'bg-green-50',   icon: 'bg-green-100 text-green-600',   text: 'text-green-600' },
  amber:  { bg: 'bg-amber-50',   icon: 'bg-amber-100 text-amber-600',   text: 'text-amber-600' },
  red:    { bg: 'bg-red-50',     icon: 'bg-red-100 text-red-600',       text: 'text-red-600' },
  purple: { bg: 'bg-purple-50',  icon: 'bg-purple-100 text-purple-600', text: 'text-purple-600' },
  slate:  { bg: 'bg-slate-50',   icon: 'bg-slate-100 text-slate-600',   text: 'text-slate-600' },
};

export function StatCard({ title, value, subtitle, icon, color = 'blue', trend }: StatCardProps) {
  const c = colorMap[color];
  return (
    <Card className={clsx('flex items-start gap-4', c.bg)}>
      {icon && (
        <div className={clsx('p-3 rounded-xl flex-shrink-0', c.icon)}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500 font-medium truncate">{title}</p>
        <p className={clsx('text-2xl font-bold mt-0.5', c.text)}>{value}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        {trend && (
          <p className={clsx('text-xs mt-1 font-medium', trend.value >= 0 ? 'text-green-600' : 'text-red-600')}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
    </Card>
  );
}
