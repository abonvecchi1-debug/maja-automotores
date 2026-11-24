import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Car, Users, Wrench,
  TrendingUp, Receipt, CheckSquare, FileText,
  UserCog, LogOut, ArrowLeftRight, MessageSquare, X, Banknote, BarChart2, ClipboardList, RefreshCw, DollarSign, FileSignature, Package, Calculator,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useStore } from '../store';
import { SyncStatus } from './SyncStatus';

type Role = 'admin' | 'empleado';
type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: Role[];
};
type NavSection = { title: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    title: 'Ventas',
    items: [
      { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/vehiculos',       icon: Car,             label: 'Vehículos' },
      { to: '/clientes',        icon: Users,           label: 'Clientes' },
      { to: '/cotizaciones',    icon: FileSignature,   label: 'Cotizaciones' },
      { to: '/tasacion',        icon: Calculator,      label: 'Tasación',        roles: ['admin'] },
      { to: '/consultas',       icon: MessageSquare,   label: 'Consultas',       roles: ['admin'] },
    ],
  },
  {
    title: 'Dinero',
    items: [
      { to: '/finanzas',        icon: TrendingUp,      label: 'Finanzas',        roles: ['admin'] },
      { to: '/gastos-fijos',    icon: Receipt,         label: 'Gastos fijos',    roles: ['admin'] },
      { to: '/creditos',        icon: Banknote,        label: 'Créditos' },
      { to: '/cheques',         icon: ClipboardList,   label: 'Cheques' },
      { to: '/dolares',         icon: DollarSign,      label: 'Dólares',         roles: ['admin'] },
      { to: '/impuestos',       icon: FileText,        label: 'Impuestos',       roles: ['admin'] },
      { to: '/reportes',        icon: BarChart2,       label: 'Reportes',        roles: ['admin'] },
    ],
  },
  {
    title: 'Gestión',
    items: [
      { to: '/proveedores',     icon: Wrench,          label: 'Proveedores',     roles: ['admin'] },
      { to: '/transferencias',  icon: ArrowLeftRight,  label: 'Transferencias',  roles: ['admin'] },
      { to: '/tareas',          icon: CheckSquare,     label: 'Tareas' },
      { to: '/bienes-capital',  icon: Package,         label: 'Bienes de capital', roles: ['admin'] },
      { to: '/usuarios',        icon: UserCog,         label: 'Usuarios',        roles: ['admin'] },
      { to: '/sincronizacion',  icon: RefreshCw,       label: 'Sincronización',  roles: ['admin'] },
    ],
  },
];

const roleLabel: Record<Role, string> = {
  admin: 'Administrador',
  empleado: 'Empleado',
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const role = user?.role;

  // Contadores al lado del menú: tareas abiertas y cheques vencidos / por vencer en 7 días.
  const pendingTasks = useStore((s) => s.tasks.filter((t) => t.status !== 'terminado').length);
  const chequeAlerts = useStore((s) => {
    const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    return s.cheques.filter((c) =>
      (c.estado === 'en_cartera' || c.estado === 'depositado') && c.fechaVencimiento && c.fechaVencimiento <= in7,
    ).length;
  });
  const badges: Record<string, { n: number; alert?: boolean }> = {
    '/tareas': { n: pendingTasks },
    '/cheques': { n: chequeAlerts, alert: true },
  };

  const visibleSections = sections
    .map((sec) => ({ ...sec, items: sec.items.filter((i) => !i.roles || (role && i.roles.includes(role))) }))
    .filter((sec) => sec.items.length > 0);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Floating glass panel */}
      <aside
        className={clsx(
          'fixed inset-y-3 left-3 z-50 w-[264px] flex flex-col flex-shrink-0 rounded-[28px] transition-transform duration-300 ease-in-out',
          'glass-strong md:glass md:relative md:inset-auto md:translate-x-0 md:z-auto md:m-3 md:mr-0 md:h-[calc(100vh-1.5rem)]',
          isOpen ? 'translate-x-0' : '-translate-x-[110%] md:translate-x-0',
        )}
      >
        {/* Logo */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-3 flex-shrink-0">
          <div className="w-11 h-11 rounded-[13px] bg-brand-600 flex items-center justify-center flex-shrink-0 shadow-[0_6px_16px_rgba(38,46,99,0.3)]">
            <svg viewBox="0 0 152.92 52.83" width="30" height="11" fill="#fff" aria-hidden="true">
              <polygon points="152.92 0 152.92 52.83 136.34 52.83 136.34 13.55 94.22 52.83 78.05 52.83 78.05 13.55 35.94 52.83 16.96 52.83 0 35.92 9.54 27.11 27.13 43.35 73.64 0 94.63 0 94.63 34.83 131.99 0 152.92 0" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[17px] font-bold tracking-tight text-slate-900 leading-tight">Maja</p>
            <p className="text-[13px] text-slate-500">Automotores</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="md:hidden p-2 rounded-full text-slate-500 hover:bg-white/70 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav aria-label="Principal" className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
          {visibleSections.map((sec) => (
            <div key={sec.title} className="space-y-px">
              <p className="px-3 pb-1 text-[13px] font-semibold text-slate-500">{sec.title}</p>
              {sec.items.map(({ to, icon: Icon, label }) => {
                const badge = badges[to];
                return (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={onClose}
                    className={({ isActive }) => clsx(
                      'flex items-center gap-3 px-2.5 py-1.5 min-h-[44px] rounded-[14px] text-[15px] font-medium transition-all duration-150',
                      isActive
                        ? 'bg-brand-600 text-white shadow-[0_6px_18px_rgba(38,46,99,0.28)]'
                        : 'text-slate-900 hover:bg-white/60',
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <span className={clsx(
                          'w-[30px] h-[30px] rounded-[9px] flex items-center justify-center flex-shrink-0 text-white',
                          isActive ? 'bg-white/20' : 'bg-brand-600',
                        )}>
                          <Icon size={17} strokeWidth={2} />
                        </span>
                        <span className="flex-1 truncate">{label}</span>
                        {badge && badge.n > 0 && (
                          <span className={clsx(
                            'min-w-[22px] px-1.5 text-center rounded-full text-[12px] font-semibold',
                            badge.alert ? 'bg-[#ff3b30] text-white'
                              : isActive ? 'bg-white/20 text-white' : 'bg-brand-600/10 text-brand-600',
                          )}>
                            {badge.n}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User + sync + logout */}
        {user && (
          <div className="mx-3 mb-3 mt-2 pt-3 px-2 flex items-center gap-3 border-t border-brand-600/10 flex-shrink-0">
            <div className="w-[38px] h-[38px] rounded-full bg-white/70 flex items-center justify-center flex-shrink-0 text-[15px] font-semibold text-brand-600 select-none">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-slate-900 truncate">{user.name}</p>
              <SyncStatus fallback={roleLabel[user.role]} />
            </div>
            <button
              onClick={logout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white/50 border border-white/70 text-brand-600 hover:bg-white/80 transition-colors"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
