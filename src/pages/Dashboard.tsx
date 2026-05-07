import { useNavigate } from 'react-router-dom';
import { Car, AlertTriangle, CheckSquare, TrendingUp, TrendingDown, DollarSign, Clock, Receipt } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useStore } from '../store';
import { StatCard, Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatCurrencyShort, formatDate, statusLabel, statusColor } from '../utils/formatters';

export function Dashboard() {
  const {
    vehicles, clients, sales, installmentPayments,
    expenses, fixedExpenseRecords, tasks, suppliers, settings,
  } = useStore();

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  // ── KPIs ──────────────────────────────────────────────────────────────

  const vehiclesInStock  = vehicles.filter((v) => v.status !== 'vendido').length;
  const vehiclesPrep     = vehicles.filter((v) => v.status === 'preparacion').length;
  const vehiclesPub      = vehicles.filter((v) => v.status === 'publicado').length;
  const soldThisMonth    = vehicles.filter((v) => v.status === 'vendido' && v.soldDate?.startsWith(thisMonth));

  const monthRevenue = soldThisMonth.reduce((acc, v) => acc + (v.soldPrice ?? 0), 0)
    + installmentPayments
        .filter((p) => p.paid && p.paidDate?.startsWith(thisMonth))
        .reduce((acc, p) => acc + p.amount, 0);

  const monthExpenses = expenses
    .filter((e) => e.date.startsWith(thisMonth))
    .reduce((acc, e) => acc + e.amount, 0)
    + fixedExpenseRecords
        .filter((r) => r.month === thisMonth)
        .reduce((acc, r) => acc + r.amount, 0);

  const monthIIBB = (soldThisMonth.reduce((acc, v) => acc + (v.soldPrice ?? 0), 0)) * (settings.iibbRate / 100);
  const monthProfit = monthRevenue - monthExpenses - monthIIBB;

  // ── Alerts ────────────────────────────────────────────────────────────

  const overdueInstallments = installmentPayments.filter((p) => !p.paid && p.dueDate < today);
  const pendingTasks        = tasks.filter((t) => t.status !== 'terminado');
  const unpaidSupplierDebts = expenses.filter((e) => e.supplierId && !e.paid);
  const pendingFixedExpenses = fixedExpenseRecords.filter((r) => r.month === thisMonth && !r.paid);
  const totalSupplierDebt   = unpaidSupplierDebts.reduce((acc, e) => acc + e.amount, 0);

  // ── Vehicle profitability ──────────────────────────────────────────────

  const vehicleProfit = (v: typeof vehicles[0]) => {
    const cost = expenses
      .filter((e) => e.vehicleId === v.id)
      .reduce((acc, e) => acc + e.amount, 0);
    const sold = v.soldPrice ?? 0;
    return sold - v.purchasePrice - cost;
  };

  // ── Chart data (last 6 months) ─────────────────────────────────────────

  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.toISOString().slice(0, 7);
    const monthLabel = d.toLocaleString('es-AR', { month: 'short' });
    const ingresos = vehicles
      .filter((v) => v.status === 'vendido' && v.soldDate?.startsWith(m))
      .reduce((acc, v) => acc + (v.soldPrice ?? 0), 0);
    const gastos = expenses
      .filter((e) => e.date.startsWith(m))
      .reduce((acc, e) => acc + e.amount, 0)
      + fixedExpenseRecords
          .filter((r) => r.month === m)
          .reduce((acc, r) => acc + r.amount, 0);
    return { mes: monthLabel, ingresos: Math.round(ingresos / 1000), gastos: Math.round(gastos / 1000) };
  });

  // Stock por antigüedad
  const stockVehicles = vehicles.filter((v) => v.status !== 'vendido');
  const stockAgeData = [
    { label: '0–30 d', count: 0, color: '#22c55e' },
    { label: '31–60 d', count: 0, color: '#f59e0b' },
    { label: '61–90 d', count: 0, color: '#f97316' },
    { label: '+90 d', count: 0, color: '#ef4444' },
  ];
  stockVehicles.forEach((v) => {
    const days = Math.floor((Date.now() - new Date(v.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) stockAgeData[0].count++;
    else if (days <= 60) stockAgeData[1].count++;
    else if (days <= 90) stockAgeData[2].count++;
    else stockAgeData[3].count++;
  });

  const navigate = useNavigate();

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Alerts row */}
      {(overdueInstallments.length > 0 || pendingFixedExpenses.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
          <div className="flex-1 text-sm text-red-700">
            {overdueInstallments.length > 0 && (
              <span className="font-medium">{overdueInstallments.length} cuota{overdueInstallments.length > 1 ? 's' : ''} vencida{overdueInstallments.length > 1 ? 's' : ''}</span>
            )}
            {overdueInstallments.length > 0 && pendingFixedExpenses.length > 0 && ' · '}
            {pendingFixedExpenses.length > 0 && (
              <span>{pendingFixedExpenses.length} gasto{pendingFixedExpenses.length > 1 ? 's' : ''} fijo{pendingFixedExpenses.length > 1 ? 's' : ''} pendiente{pendingFixedExpenses.length > 1 ? 's' : ''} este mes</span>
            )}
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Ingresos del mes"
          value={formatCurrencyShort(monthRevenue)}
          subtitle="ventas + cuotas cobradas"
          icon={<TrendingUp size={20} />}
          color="green"
        />
        <StatCard
          title="Gastos del mes"
          value={formatCurrencyShort(monthExpenses)}
          subtitle={`+${formatCurrencyShort(monthIIBB)} IIBB estimado`}
          icon={<TrendingDown size={20} />}
          color="red"
        />
        <StatCard
          title="Ganancia neta"
          value={formatCurrencyShort(monthProfit)}
          subtitle="descontando gastos e IIBB"
          icon={<DollarSign size={20} />}
          color={monthProfit >= 0 ? 'blue' : 'red'}
        />
        <StatCard
          title="Deuda a proveedores"
          value={formatCurrencyShort(totalSupplierDebt)}
          subtitle={`${unpaidSupplierDebts.length} trabajos pendientes`}
          icon={<AlertTriangle size={20} />}
          color="amber"
        />
      </div>

      {/* Stock cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button onClick={() => navigate('/vehiculos')} className="text-left">
          <StatCard title="Stock total" value={vehiclesInStock} subtitle="vehículos disponibles" icon={<Car size={20} />} color="slate" />
        </button>
        <button onClick={() => navigate('/vehiculos?status=preparacion')} className="text-left">
          <StatCard title="En preparación" value={vehiclesPrep} subtitle="pendientes de listo" icon={<Clock size={20} />} color="amber" />
        </button>
        <button onClick={() => navigate('/vehiculos?status=publicado')} className="text-left">
          <StatCard title="Publicados" value={vehiclesPub} subtitle="en el mercado" icon={<Car size={20} />} color="blue" />
        </button>
        <button onClick={() => navigate('/vehiculos?status=vendido')} className="text-left">
          <StatCard title="Vendidos este mes" value={soldThisMonth.length} subtitle={`${formatCurrencyShort(soldThisMonth.reduce((a, v) => a + (v.soldPrice ?? 0), 0))} facturado`} icon={<TrendingUp size={20} />} color="green" />
        </button>
      </div>

      {/* Chart + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sales chart */}
        <Card className="xl:col-span-2">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Ingresos vs Gastos (últimos 6 meses)</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}K`} />
                <Tooltip
                  formatter={(v: number, name: string) => [`$${v.toLocaleString('es-AR')}K`, name === 'ingresos' ? 'Ingresos' : 'Gastos']}
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '13px' }}
                />
                <Legend formatter={(value) => value === 'ingresos' ? 'Ingresos' : 'Gastos'} wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Area type="monotone" dataKey="ingresos" stroke="#3b82f6" strokeWidth={2} fill="url(#gradIngresos)" />
                <Area type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} fill="url(#gradGastos)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Quick alerts */}
        <Card>
          <h3 className="text-base font-semibold text-slate-900 mb-4">Alertas</h3>
          <div className="space-y-3">
            {overdueInstallments.length === 0 && pendingTasks.filter(t => t.priority === 'alta').length === 0 && unpaidSupplierDebts.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Sin alertas pendientes</p>
            )}
            {overdueInstallments.map((p) => {
              const sale = sales.find((s) => s.id === p.saleId);
              const client = clients.find((c) => c.id === sale?.clientId);
              return (
                <div key={p.id} className="flex items-start gap-2 p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors" onClick={() => client && navigate(`/clientes/${client.id}`)}>
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-900">{client?.firstName} {client?.lastName}</p>
                    <p className="text-xs text-red-700">Cuota {p.installmentNumber} vencida · {formatCurrency(p.amount)}</p>
                  </div>
                </div>
              );
            })}
            {pendingTasks.filter(t => t.priority === 'alta').slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => navigate('/tareas')}>
                <Clock size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-900">{t.title}</p>
                  <p className="text-xs text-amber-700">Prioridad alta{t.dueDate ? ` · ${formatDate(t.dueDate)}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Stock por antigüedad */}
      {stockVehicles.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-slate-900">Stock por antigüedad</h3>
            <p className="text-xs text-slate-500">{stockVehicles.length} vehículos en stock</p>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            {stockAgeData.map((d) => (
              <div key={d.label} className="text-center p-3 rounded-xl bg-slate-50">
                <p className="text-2xl font-bold" style={{ color: d.color }}>{d.count}</p>
                <p className="text-xs text-slate-500 mt-1">{d.label}</p>
              </div>
            ))}
          </div>
          {stockAgeData[2].count + stockAgeData[3].count > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              {stockAgeData[2].count + stockAgeData[3].count} vehículo{stockAgeData[2].count + stockAgeData[3].count > 1 ? 's' : ''} con más de 60 días en stock — considerar revisar precio de publicación.
            </div>
          )}
        </Card>
      )}

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Vehicles list */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Vehículos activos</h3>
            <button onClick={() => navigate('/vehiculos')} className="text-xs text-brand-600 hover:underline">Ver todos</button>
          </div>
          <div className="divide-y divide-slate-100">
            {vehicles.filter((v) => v.status !== 'vendido').slice(0, 5).map((v) => {
              const cost = expenses.filter((e) => e.vehicleId === v.id).reduce((a, e) => a + e.amount, 0);
              const invested = v.purchasePrice + cost;
              return (
                <div
                  key={v.id}
                  className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/vehiculos/${v.id}`)}
                >
                  <div className="w-9 h-9 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Car size={16} className="text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{v.brand} {v.model} {v.year}</p>
                    <p className="text-xs text-slate-500">{v.patent} · Invertido: {formatCurrencyShort(invested)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[v.status]}`}>
                    {statusLabel[v.status]}
                  </span>
                </div>
              );
            })}
            {vehicles.filter((v) => v.status !== 'vendido').length === 0 && (
              <p className="px-6 py-6 text-sm text-slate-400 text-center">Sin vehículos en stock</p>
            )}
          </div>
        </Card>

        {/* Tasks */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Tareas pendientes</h3>
            <button onClick={() => navigate('/tareas')} className="text-xs text-brand-600 hover:underline">Ver todas</button>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingTasks.slice(0, 5).map((t) => {
              const veh = vehicles.find((v) => v.id === t.vehicleId);
              const cli = clients.find((c) => c.id === t.clientId);
              return (
                <div
                  key={t.id}
                  className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => navigate('/tareas')}
                >
                  <CheckSquare size={16} className={
                    t.priority === 'alta' ? 'text-red-500' :
                    t.priority === 'media' ? 'text-amber-500' : 'text-slate-400'
                  } />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{t.title}</p>
                    <p className="text-xs text-slate-500">
                      {veh ? `${veh.brand} ${veh.model}` : cli ? `${cli.firstName} ${cli.lastName}` : 'General'}
                      {t.dueDate ? ` · Vence ${formatDate(t.dueDate)}` : ''}
                    </p>
                  </div>
                  <Badge className={t.status === 'en_proceso' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}>
                    {t.status === 'en_proceso' ? 'En proceso' : 'Pendiente'}
                  </Badge>
                </div>
              );
            })}
            {pendingTasks.length === 0 && (
              <p className="px-6 py-6 text-sm text-slate-400 text-center">Sin tareas pendientes</p>
            )}
          </div>
        </Card>
      </div>

      {/* Egresos variables del mes */}
      {(() => {
        const monthVarExpenses = expenses.filter((e) => e.date.startsWith(thisMonth));
        const totalVar = monthVarExpenses.reduce((a, e) => a + e.amount, 0);
        const paidVar = monthVarExpenses.filter((e) => e.paid).reduce((a, e) => a + e.amount, 0);
        const pendingVar = totalVar - paidVar;
        const categoryLabels: Record<string, string> = {
          mecanica: 'Mecánica', lavado: 'Lavado', pintura: 'Pintura', documentacion: 'Documentación',
          comision: 'Comisión', publicidad: 'Publicidad', combustible: 'Combustible',
          impuesto: 'Impuesto', otro: 'Otro',
        };
        return (
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Egresos del mes</h3>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500">
                  Pagado: <span className="text-green-600 font-medium">{formatCurrency(paidVar)}</span>
                </span>
                <span className="text-sm text-slate-500">
                  Pendiente: <span className="text-red-600 font-medium">{formatCurrency(pendingVar)}</span>
                </span>
                <button onClick={() => navigate('/finanzas')} className="text-xs text-brand-600 hover:underline">Ver todos</button>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {monthVarExpenses.length === 0 && (
                <p className="px-6 py-6 text-sm text-slate-400 text-center">No hay egresos registrados para este mes.</p>
              )}
              {monthVarExpenses.slice(0, 6).map((e) => (
                <div key={e.id} className="px-6 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Receipt size={14} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{e.description}</p>
                    <p className="text-xs text-slate-500">{categoryLabels[e.category] ?? e.category} · {e.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(e.amount)}</p>
                    <p className={`text-xs ${e.paid ? 'text-green-600' : 'text-amber-600'}`}>
                      {e.paid ? 'Pagado' : 'Pendiente'}
                    </p>
                  </div>
                </div>
              ))}
              {monthVarExpenses.length > 6 && (
                <div className="px-6 py-3 text-center">
                  <button onClick={() => navigate('/finanzas')} className="text-xs text-brand-600 hover:underline">
                    Ver {monthVarExpenses.length - 6} más →
                  </button>
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Gastos fijos del mes */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Gastos fijos del mes</h3>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              Pagado: <span className="text-green-600 font-medium">
                {formatCurrency(fixedExpenseRecords.filter(r => r.month === thisMonth && r.paid).reduce((a, r) => a + r.amount, 0))}
              </span>
            </span>
            <span className="text-sm text-slate-500">
              Pendiente: <span className="text-red-600 font-medium">
                {formatCurrency(fixedExpenseRecords.filter(r => r.month === thisMonth && !r.paid).reduce((a, r) => a + r.amount, 0))}
              </span>
            </span>
            <button onClick={() => navigate('/gastos-fijos')} className="text-xs text-brand-600 hover:underline">Gestionar</button>
          </div>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
          {fixedExpenseRecords.filter((r) => r.month === thisMonth).map((r) => (
            <div key={r.id} className={`p-3 rounded-lg border ${r.paid ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-xs font-medium text-slate-700 truncate">{r.typeName}</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(r.amount)}</p>
              <p className={`text-xs mt-1 ${r.paid ? 'text-green-600' : 'text-slate-500'}`}>
                {r.paid ? `Pagado ${formatDate(r.paidDate)}` : `Vence ${formatDate(r.dueDate)}`}
              </p>
            </div>
          ))}
          {fixedExpenseRecords.filter((r) => r.month === thisMonth).length === 0 && (
            <p className="col-span-full text-sm text-slate-400 py-2">No hay gastos fijos registrados para este mes.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
