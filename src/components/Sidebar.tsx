import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Car, Users, Wrench,
  TrendingUp, Receipt, CheckSquare, FileText,
  UserCog, LogOut, ArrowLeftRight, MessageSquare, Wallet, X, Banknote, BarChart2,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const BRAND_NAVY = '#262e63';

type NavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  roles?: ('admin' | 'empleado')[];
};

const navItems: NavItem[] = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vehiculos',       icon: Car,             label: 'Vehículos' },
  { to: '/clientes',        icon: Users,           label: 'Clientes' },
  { to: '/consultas',       icon: MessageSquare,   label: 'Consultas',       roles: ['admin'] },
  { to: '/caja',            icon: Wallet,          label: 'Caja Diaria',     roles: ['admin'] },
  { to: '/proveedores',     icon: Wrench,          label: 'Proveedores',     roles: ['admin'] },
  { to: '/transferencias',  icon: ArrowLeftRight,  label: 'Transferencias',  roles: ['admin'] },
  { to: '/finanzas',        icon: TrendingUp,      label: 'Finanzas',        roles: ['admin'] },
  { to: '/gastos-fijos',    icon: Receipt,         label: 'Gastos Fijos',    roles: ['admin'] },
  { to: '/tareas',          icon: CheckSquare,     label: 'Tareas' },
  { to: '/creditos',        icon: Banknote,        label: 'Créditos' },
  { to: '/reportes',        icon: BarChart2,        label: 'Reportes',        roles: ['admin'] },
  { to: '/impuestos',       icon: FileText,        label: 'Impuestos',       roles: ['admin'] },
  { to: '/usuarios',        icon: UserCog,         label: 'Usuarios',        roles: ['admin'] },
];

const roleLabel: Record<'admin' | 'empleado', string> = {
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

  const visibleItems = navItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-64 flex flex-col h-full flex-shrink-0 transition-transform duration-300 ease-in-out',
          'md:relative md:translate-x-0 md:z-auto md:h-screen',
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
        style={{ backgroundColor: BRAND_NAVY }}
      >
        {/* ── Logo header ── */}
        <div
          className="px-6 py-5 flex-shrink-0 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 384.2 79.64"
            fill="white"
            className="w-full max-w-[190px] h-auto"
            aria-label="Maja Automotores"
          >
            <polygon points="240.46 0 240.46 52.83 223.88 52.83 223.88 13.55 181.77 52.83 162.35 52.83 219.03 0 240.46 0"/>
            <polygon points="152.92 0 152.92 52.83 136.34 52.83 136.34 13.55 94.22 52.83 78.05 52.83 78.05 13.55 35.94 52.83 16.96 52.83 0 35.92 9.54 27.11 27.13 43.35 73.64 0 94.63 0 94.63 34.83 131.99 0 152.92 0"/>
            <polygon points="323.73 0 342.76 0 286.06 52.83 267.12 52.83 250.12 35.92 259.66 27.11 277.24 43.35 323.73 0"/>
            <polygon points="384.2 0 384.2 52.83 367.62 52.83 367.62 13.55 325.51 52.83 306.09 52.83 362.77 0 384.2 0"/>
            <text
              transform="translate(75.35 79.02)"
              fontSize="11.94"
              fontFamily="Inter, system-ui, sans-serif"
              fontWeight="600"
              letterSpacing="2.4"
              fill="white"
              opacity="0.65"
            >
              AUTOMOTORES
            </text>
          </svg>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="md:hidden ml-2 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/90',
              )}
              style={({ isActive }) =>
                isActive ? { backgroundColor: 'rgba(255,255,255,0.12)' } : undefined
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={17}
                    strokeWidth={isActive ? 2.2 : 1.8}
                    style={{ opacity: isActive ? 1 : 0.45 }}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── User info + logout ── */}
        {user && (
          <div
            className="px-4 py-4 flex-shrink-0 space-y-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-3 px-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white select-none"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white/90 truncate">{user.name}</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {roleLabel[user.role]}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 text-white/40 hover:text-white/80 hover:bg-white/[0.06]"
            >
              <LogOut size={15} strokeWidth={1.8} style={{ opacity: 0.6 }} />
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
