import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { useStore } from './store';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Vehicles } from './pages/Vehicles';
import { VehicleDetail } from './pages/VehicleDetail';
import { Clients } from './pages/Clients';
import { ClientDetail } from './pages/ClientDetail';
import { Suppliers } from './pages/Suppliers';
import { SupplierDetail } from './pages/SupplierDetail';
import { Finance } from './pages/Finance';
import { FixedExpenses } from './pages/FixedExpenses';
import { Tasks } from './pages/Tasks';
import { Taxes } from './pages/Taxes';
import { Users } from './pages/Users';
import { Transfers } from './pages/Transfers';
import { Leads } from './pages/Leads';
import { DailyCash } from './pages/DailyCash';
import { Credits } from './pages/Credits';
import { Reports } from './pages/Reports';
import { Cheques } from './pages/Cheques';
import { Senas } from './pages/Senas';
import { SyncSettings } from './pages/SyncSettings';

/** Runs checkAuth on mount and loads all app data once authenticated. */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadAll = useStore((s) => s.loadAll);
  const initialized = useStore((s) => s.initialized);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated && !initialized) loadAll();
  }, [isAuthenticated, initialized, loadAll]);

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInitializer>
        <Routes>
          {/* Public route — fullscreen, no Layout */}
          <Route path="/login" element={<Login />} />

          {/* Protected app routes — inside Layout */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="vehiculos" element={<Vehicles />} />
            <Route path="vehiculos/:id" element={<VehicleDetail />} />
            <Route path="clientes" element={<Clients />} />
            <Route path="clientes/:id" element={<ClientDetail />} />

            {/* Admin-only routes */}
            <Route
              path="proveedores"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Suppliers />
                </ProtectedRoute>
              }
            />
            <Route
              path="proveedores/:id"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <SupplierDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="finanzas"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Finance />
                </ProtectedRoute>
              }
            />
            <Route
              path="gastos-fijos"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <FixedExpenses />
                </ProtectedRoute>
              }
            />
            <Route
              path="impuestos"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Taxes />
                </ProtectedRoute>
              }
            />
            <Route
              path="usuarios"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <Users />
                </ProtectedRoute>
              }
            />

            <Route path="transferencias" element={<ProtectedRoute allowedRoles={['admin']}><Transfers /></ProtectedRoute>} />
            <Route path="consultas" element={<ProtectedRoute allowedRoles={['admin']}><Leads /></ProtectedRoute>} />
            <Route path="caja" element={<ProtectedRoute allowedRoles={['admin']}><DailyCash /></ProtectedRoute>} />

            {/* Available to all authenticated users */}
            <Route path="tareas" element={<Tasks />} />
            <Route path="creditos" element={<Credits />} />
            <Route path="cheques" element={<Cheques />} />
            <Route path="senas" element={<Senas />} />
            <Route path="reportes" element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
            <Route path="sincronizacion" element={<ProtectedRoute allowedRoles={['admin']}><SyncSettings /></ProtectedRoute>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthInitializer>
    </BrowserRouter>
  );
}
