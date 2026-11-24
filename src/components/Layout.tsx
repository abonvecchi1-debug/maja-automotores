import { useState, Suspense } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { BirthdayBanner } from './BirthdayBanner';
import { useAuthStore } from '../store/authStore';

/** Manchas de color fijas detrás de todo: es lo que el vidrio desenfoca. */
export function GlassBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      <div className="absolute -top-40 left-[8%] w-[560px] h-[560px] rounded-full bg-[#8f9bff] opacity-[0.45] blur-[90px]" />
      <div className="absolute top-[30%] -right-36 w-[620px] h-[620px] rounded-full bg-brand-600 opacity-[0.28] blur-[100px]" />
      <div className="absolute -bottom-52 left-[36%] w-[600px] h-[600px] rounded-full bg-[#74c8ff] opacity-40 blur-[100px]" />
      <div className="absolute top-20 right-[28%] w-[380px] h-[380px] rounded-full bg-[#d3c2ff] opacity-50 blur-[80px]" />
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="Cargando">
      <span className="w-7 h-7 border-[3px] border-brand-600/20 border-t-brand-600 rounded-full animate-spin" />
    </div>
  );
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#eceef7]">
      <GlassBackdrop />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="relative flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden glass flex items-center justify-between mx-3 mt-3 px-3 py-2 rounded-2xl flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            className="p-2 rounded-xl text-brand-600 hover:bg-white/60 transition-colors"
          >
            <Menu size={22} />
          </button>
          <span className="font-bold text-slate-900 text-sm">Maja Automotores</span>
          <div className="w-10" />
        </header>
        <BirthdayBanner />
        <main className="flex-1 overflow-y-auto">
          {/* Las pantallas se cargan a demanda: mientras baja una, el menú queda fijo. */}
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
