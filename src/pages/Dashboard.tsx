import { useNavigate } from 'react-router-dom';
import {
  Car, AlertTriangle, CheckSquare, Receipt, Plus, ChevronRight,
  Banknote, ClipboardList, CalendarDays, FileText,
} from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { clsx } from 'clsx';
import { useStore } from '../store';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { formatCurrency, formatCurrencyShort, formatDate, formatAxisThousands, statusLabel, statusColor } from '../utils/formatters';
import { usdRealizedProfits, allSaleProfitEvents } from '../utils/finance';

const BRAND = '#262e63';
const ORANGE = '#ff9500';

// Colores del anillo de stock (de nuevo → viejo)
const AGE_COLORS = ['#34c759', '#ffcc00', '#ff9500', '#ff3b30'];

/** Anillo completo en degradado continuo (también de rojo a verde), proporcional al stock por antigüedad. */
function stockRingGradient(counts: number[]) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 'rgba(38,46,99,0.08)';
  const deg = counts.map((c) => (c / total) * 360);
  const s1 = deg[0];
  const s2 = s1 + deg[1];
  const s3 = s2 + deg[2];
  const stops = [
    `${AGE_COLORS[0]} 0deg`,
    `${AGE_COLORS[0]} ${(s1 * 0.6).toFixed(1)}deg`,
    `${AGE_COLORS[1]} ${(s1 + deg[1] / 2).toFixed(1)}deg`,
    `${AGE_COLORS[2]} ${(s2 + deg[2] / 2).toFixed(1)}deg`,
    `${AGE_COLORS[3]} ${(s3 + deg[3] * 0.4).toFixed(1)}deg`,
    `${AGE_COLORS[0]} 360deg`,
  ];
  return `conic-gradient(in oklch, ${stops.join(', ')})`;
}

const RING_MASK = 'radial-gradient(farthest-side, transparent calc(100% - 15px), #000 calc(100% - 14px))';

type DueItem = {
  key: string;
  date: string;
  title: string;
  amount: string;
  icon: React.ElementType;
  onClick: () => void;
};

export function Dashboard() {
  const {
    vehicles, clients, sales, installmentPayments,
    expenses, fixedExpenseRecords, tasks, settings, transactions, taxPayments, cheques, usdOperations,
  } = useStore();
  const navigate = useNavigate();

  // Ganancia/pérdida realizada de dólares por venta (mismo cálculo que Finanzas y el apartado Dólares).
  const usdProfits = usdRealizedProfits(usdOperations);
  const usdGanancia = (month: string) => usdProfits.filter((p) => (p.date || '').startsWith(month) && p.profit >= 0).reduce((a, p) => a + p.profit, 0);
  const usdPerdida = (month: string) => usdProfits.filter((p) => (p.date || '').startsWith(month) && p.profit < 0).reduce((a, p) => a - p.profit, 0);

  // Ganancia de autos reconocida por mes (igual criterio que Finanzas): 'upfront' = toda al vender;
  // 'collected' (financiadas nuevas) = entrega + cada cuota cobrada en su mes.
  const saleEvents = allSaleProfitEvents(vehicles, sales, installmentPayments);
  const saleGanancia = (month: string) => saleEvents.filter((e) => e.date.startsWith(month) && e.amount > 0).reduce((a, e) => a + e.amount, 0);
  const salePerdida = (month: string) => saleEvents.filter((e) => e.date.startsWith(month) && e.amount < 0).reduce((a, e) => a - e.amount, 0);

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.slice(0, 7);

  // ── Ingresos / gastos de un mes (mismo criterio que Finanzas) ─────────
  // Ingresos = GANANCIA de las ventas (precio − costo), no el precio total. Comprar el auto
  // no es gasto (es capital), así que el costo no figura como egreso: ya está en la ganancia.
  const revenueOf = (m: string) => saleGanancia(m)
    + transactions
        .filter((t) => t.type === 'ingreso' && t.category !== 'saldo_inicial' && t.date.startsWith(m))
        .reduce((acc, t) => acc + t.amount, 0)
    + usdGanancia(m);  // ganancia por venta de dólares

  const expensesOf = (m: string) => expenses
    .filter((e) => e.date.startsWith(m))
    .reduce((acc, e) => acc + e.amount, 0)
    + fixedExpenseRecords
        .filter((r) => (r.dueDate || `${r.month}-01`).startsWith(m))  // mismo criterio que Finanzas
        .reduce((acc, r) => acc + r.amount, 0)
    + transactions
        .filter((t) => t.type === 'egreso' && t.paid !== false && t.date.startsWith(m))
        .reduce((acc, t) => acc + t.amount, 0)
    + taxPayments
        .filter((t) => t.paid && t.paidDate?.startsWith(m))
        .reduce((acc, t) => acc + t.amount, 0)
    // Solo cuenta como egreso si se vendió a pérdida (costo mayor a lo cobrado).
    + salePerdida(m)
    + usdPerdida(m);  // pérdida por venta de dólares

  // ── KPIs ──────────────────────────────────────────────────────────────

  const vehiclesInStock  = vehicles.filter((v) => v.status !== 'vendido').length;
  const vehiclesPrep     = vehicles.filter((v) => v.status === 'preparacion').length;
  const vehiclesPub      = vehicles.filter((v) => v.status === 'publicado').length;
  const soldThisMonth    = vehicles.filter((v) => v.status === 'vendido' && v.soldDate?.startsWith(thisMonth));

  const monthRevenue  = revenueOf(thisMonth);
  const monthExpenses = expensesOf(thisMonth);
  const monthIIBB = (soldThisMonth.reduce((acc, v) => acc + (v.soldPrice ?? 0), 0)) * (settings.iibbRate / 100);
  const monthProfit = monthRevenue - monthExpenses;

  // ── Alerts ────────────────────────────────────────────────────────────

  const overdueInstallments = installmentPayments.filter((p) => !p.paid && p.dueDate < today);
  const pendingTasks        = tasks.filter((t) => t.status !== 'terminado');
  const unpaidSupplierDebts = expenses.filter((e) => e.supplierId && !e.paid);
  const pendingFixedExpenses = fixedExpenseRecords.filter((r) => r.month === thisMonth && !r.paid);
  const totalSupplierDebt   = unpaidSupplierDebts.reduce((acc, e) => acc + e.amount, 0);

  // Cheques en cartera próximos a vencer / vencidos (para no perder fechas de cobro)
  const in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const chequesActivos = cheques.filter((c) => c.estado === 'en_cartera' || c.estado === 'depositado');
  const chequesVencidos = chequesActivos.filter((c) => c.fechaVencimiento && c.fechaVencimiento < today);
  const chequesPorVencer = chequesActivos.filter((c) => c.fechaVencimiento && c.fechaVencimiento >= today && c.fechaVencimiento <= in7Days);
  const alertCount = overdueInstallments.length + pendingFixedExpenses.length + chequesVencidos.length + chequesPorVencer.length;

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
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const m = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('es-AR', { month: 'short' }).replace('.', '');
    return {
      mes: label.charAt(0).toUpperCase() + label.slice(1),
      ingresos: Math.round(revenueOf(m) / 1000),
      gastos: Math.round(expensesOf(m) / 1000),
    };
  });
  const prevRevenue = chartData[4].ingresos * 1000;
  const revenueDelta = prevRevenue > 0 ? Math.round(((monthRevenue - prevRevenue) / prevRevenue) * 100) : null;

  // ── Stock por antigüedad ───────────────────────────────────────────────
  const stockVehicles = vehicles.filter((v) => v.status !== 'vendido');
  const stockAgeData = [
    { label: '0–30 días', count: 0 },
    { label: '31–60 días', count: 0 },
    { label: '61–90 días', count: 0 },
    { label: '+90 días', count: 0 },
  ];
  stockVehicles.forEach((v) => {
    const days = Math.floor((Date.now() - new Date(v.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) stockAgeData[0].count++;
    else if (days <= 60) stockAgeData[1].count++;
    else if (days <= 90) stockAgeData[2].count++;
    else stockAgeData[3].count++;
  });
  const oldStock = stockAgeData[2].count + stockAgeData[3].count;

  // ── Últimas ventas ─────────────────────────────────────────────────────
  const recentSales = [...sales]
    .sort((a, b) => (b.saleDate || '').localeCompare(a.saleDate || ''))
    .slice(0, 5)
    .map((s) => {
      const v = vehicles.find((x) => x.id === s.vehicleId);
      const c = clients.find((x) => x.id === s.clientId);
      return { sale: s, vehicle: v, client: c, profit: v ? vehicleProfit(v) : null };
    });

  // ── Próximos vencimientos (vencidos + próximos 14 días) ───────────────
  const in14Days = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const dueItems: DueItem[] = [
    ...installmentPayments
      .filter((p) => !p.paid && p.dueDate && p.dueDate <= in14Days)
      .map((p): DueItem => {
        const sale = sales.find((s) => s.id === p.saleId);
        const client = clients.find((c) => c.id === sale?.clientId);
        return {
          key: `i-${p.id}`, date: p.dueDate, icon: Banknote,
          title: `Cuota ${p.installmentNumber}${client ? ` · ${client.firstName} ${client.lastName}` : ''}`,
          amount: formatCurrencyShort(p.amount),
          onClick: () => navigate(client ? `/clientes/${client.id}` : '/creditos'),
        };
      }),
    ...chequesActivos
      .filter((c) => c.fechaVencimiento && c.fechaVencimiento <= in14Days)
      .map((c): DueItem => ({
        key: `c-${c.id}`, date: c.fechaVencimiento, icon: ClipboardList,
        title: `Cheque${c.banco ? ` · ${c.banco}` : ''}`,
        amount: c.moneda === 'USD' ? `US$ ${c.monto.toLocaleString('es-AR')}` : formatCurrencyShort(c.monto),
        onClick: () => navigate('/cheques'),
      })),
    ...fixedExpenseRecords
      .filter((r) => !r.paid && r.dueDate && r.dueDate <= in14Days)
      .map((r): DueItem => ({
        key: `f-${r.id}`, date: r.dueDate, icon: CalendarDays,
        title: r.typeName, amount: formatCurrencyShort(r.amount),
        onClick: () => navigate('/gastos-fijos'),
      })),
    ...taxPayments
      .filter((t) => !t.paid && t.dueDate && t.dueDate <= in14Days)
      .map((t): DueItem => ({
        key: `t-${t.id}`, date: t.dueDate, icon: FileText,
        title: t.description, amount: formatCurrencyShort(t.amount),
        onClick: () => navigate('/impuestos'),
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const dueStatus = (date: string) => {
    if (date < today) {
      const days = Math.round((new Date(today).getTime() - new Date(date).getTime()) / 86400000);
      return { text: `Vencido hace ${days} día${days === 1 ? '' : 's'}`, tile: 'bg-[#ff3b30]', sub: 'text-[#c2000f] font-semibold' };
    }
    if (date === today) return { text: 'Vence hoy', tile: 'bg-[#ff9500]', sub: 'text-[#7a4200] font-semibold' };
    return { text: `Vence ${formatDate(date)}`, tile: 'bg-brand-600', sub: 'text-slate-600' };
  };

  const dateLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="p-4 sm:p-6 lg:px-8 space-y-5 max-w-[1240px] mx-auto">
      {/* Large title */}
      <div className="flex flex-wrap items-end gap-3 pt-1">
        <div className="flex-1 min-w-[220px]">
          <p className="text-[13px] font-semibold text-slate-600 uppercase tracking-wide">{dateLabel}</p>
          <h1 className="text-[34px] leading-tight font-bold tracking-tight text-slate-900">Resumen</h1>
        </div>
        <button
          onClick={() => navigate('/vehiculos')}
          className="h-11 px-5 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-[15px] font-semibold flex items-center gap-1.5 shadow-[0_6px_20px_rgba(38,46,99,0.3)] transition-colors"
        >
          <Plus size={17} strokeWidth={2.6} />
          Nueva venta
        </button>
      </div>

      {/* Notification-style alert */}
      {alertCount > 0 && (
        <div className="glass rounded-[22px] px-4 py-3.5 flex items-center gap-3.5">
          <span className="w-10 h-10 rounded-xl bg-[#ff9500] text-white flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} strokeWidth={2.2} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold text-slate-900">
              {alertCount} cosa{alertCount > 1 ? 's' : ''} para revisar
            </p>
            <div className="flex flex-wrap gap-x-1.5 text-sm text-slate-600">
              {overdueInstallments.length > 0 && (
                <button onClick={() => navigate('/creditos')} className="hover:text-brand-600 hover:underline">
                  {overdueInstallments.length} cuota{overdueInstallments.length > 1 ? 's' : ''} vencida{overdueInstallments.length > 1 ? 's' : ''}
                </button>
              )}
              {chequesVencidos.length > 0 && (
                <button onClick={() => navigate('/cheques')} className="hover:text-brand-600 hover:underline">
                  · {chequesVencidos.length} cheque{chequesVencidos.length > 1 ? 's' : ''} vencido{chequesVencidos.length > 1 ? 's' : ''} en cartera
                </button>
              )}
              {chequesPorVencer.length > 0 && (
                <button onClick={() => navigate('/cheques')} className="hover:text-brand-600 hover:underline">
                  · {chequesPorVencer.length} cheque{chequesPorVencer.length > 1 ? 's' : ''} vence{chequesPorVencer.length > 1 ? 'n' : ''} esta semana
                </button>
              )}
              {pendingFixedExpenses.length > 0 && (
                <button onClick={() => navigate('/gastos-fijos')} className="hover:text-brand-600 hover:underline">
                  · {pendingFixedExpenses.length} gasto{pendingFixedExpenses.length > 1 ? 's' : ''} fijo{pendingFixedExpenses.length > 1 ? 's' : ''} sin pagar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass rounded-[24px] p-5">
          <p className="text-sm font-semibold text-slate-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#34c759]" />Ingresos del mes</p>
          <p className="text-[30px] font-bold tracking-tight text-slate-900 mt-2 leading-tight">{formatCurrencyShort(monthRevenue)}</p>
          <p className="mt-2">
            {revenueDelta !== null ? (
              <span className={clsx('text-xs font-semibold rounded-full px-2.5 py-1', revenueDelta >= 0 ? 'text-[#1a6e34] bg-[#34c759]/15' : 'text-[#c2000f] bg-[#ff3b30]/15')}>
                {revenueDelta >= 0 ? '↑' : '↓'} {Math.abs(revenueDelta)}% vs. mes anterior
              </span>
            ) : (
              <span className="text-[13px] text-slate-600">ventas + cuotas cobradas</span>
            )}
          </p>
        </div>
        <div className="glass rounded-[24px] p-5">
          <p className="text-sm font-semibold text-slate-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ff9500]" />Gastos del mes</p>
          <p className="text-[30px] font-bold tracking-tight text-slate-900 mt-2 leading-tight">{formatCurrencyShort(monthExpenses)}</p>
          <p className="mt-2">
            <span className="text-xs font-semibold rounded-full px-2.5 py-1 text-[#7a4200] bg-[#ff9500]/15">
              + {formatCurrencyShort(monthIIBB)} IIBB estimado
            </span>
          </p>
        </div>
        <div className="glass-navy rounded-[24px] p-5">
          <p className="text-sm font-semibold text-white/80">Ganancia neta</p>
          <p className="text-[30px] font-bold tracking-tight mt-2 leading-tight">{formatCurrencyShort(monthProfit)}</p>
          <p className="mt-2">
            <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-white/15">ingresos − gastos del mes</span>
          </p>
        </div>
        <button onClick={() => navigate('/proveedores')} className="glass rounded-[24px] p-5 text-left hover:bg-white/70 transition-colors">
          <p className="text-sm font-semibold text-slate-600 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#af52de]" />Deuda a proveedores</p>
          <p className="text-[30px] font-bold tracking-tight text-slate-900 mt-2 leading-tight">{formatCurrencyShort(totalSupplierDebt)}</p>
          <p className="mt-2 text-[13px] text-slate-600">{unpaidSupplierDebts.length} trabajo{unpaidSupplierDebts.length === 1 ? '' : 's'} pendiente{unpaidSupplierDebts.length === 1 ? '' : 's'}</p>
        </button>
      </div>

      {/* Chart + stock ring */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-start gap-3 mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Ingresos y gastos</h2>
              <p className="text-sm text-slate-600">Últimos 6 meses</p>
            </div>
            <span className="flex items-center gap-1.5 text-[13px] text-slate-600"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: BRAND }} />Ingresos</span>
            <span className="flex items-center gap-1.5 text-[13px] text-slate-600"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: ORANGE }} />Gastos</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barGap={5} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="rgba(38,46,99,0.08)" />
                <XAxis dataKey="mes" tick={{ fontSize: 13, fill: '#4a4a55' }} axisLine={false} tickLine={false} />
                <YAxis width={56} tick={{ fontSize: 12, fill: '#4a4a55' }} axisLine={false} tickLine={false} tickFormatter={formatAxisThousands} />
                <Tooltip
                  cursor={{ fill: 'rgba(38,46,99,0.05)', radius: 10 }}
                  formatter={(v: number, name: string) => [formatCurrency(v * 1000), name === 'ingresos' ? 'Ingresos' : 'Gastos']}
                  contentStyle={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', boxShadow: '0 8px 30px rgba(38,46,99,0.15)', fontSize: '13px' }}
                />
                <Bar dataKey="ingresos" fill={BRAND} radius={[8, 8, 4, 4]} maxBarSize={18}>
                  {chartData.map((_, i) => <Cell key={i} fillOpacity={i === chartData.length - 1 ? 1 : 0.45} />)}
                </Bar>
                <Bar dataKey="gastos" fill={ORANGE} radius={[8, 8, 4, 4]} maxBarSize={18}>
                  {chartData.map((_, i) => <Cell key={i} fillOpacity={i === chartData.length - 1 ? 1 : 0.45} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center">
            <h2 className="flex-1 text-xl font-bold tracking-tight text-slate-900">Stock</h2>
            <button onClick={() => navigate('/vehiculos')} className="text-[15px] font-semibold text-brand-600 hover:opacity-70">Ver todo</button>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative w-[132px] h-[132px] flex-shrink-0" role="img" aria-label={`${vehiclesInStock} autos en stock por antigüedad`}>
              <div
                className="absolute inset-0 rounded-full"
                style={{ background: stockRingGradient(stockAgeData.map((d) => d.count)), WebkitMaskImage: RING_MASK, maskImage: RING_MASK }}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[30px] font-bold tracking-tight leading-none text-slate-900">{vehiclesInStock}</span>
                <span className="text-xs text-slate-600">autos</span>
              </div>
            </div>
            <div className="flex-1 space-y-2 text-sm">
              {stockAgeData.map((d, i) => (
                <div key={d.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: AGE_COLORS[i] }} />
                  <span className="flex-1 text-slate-700">{d.label}</span>
                  <b className="text-slate-900">{d.count}</b>
                </div>
              ))}
            </div>
          </div>
          {oldStock > 0 && (
            <p className="text-xs text-[#7a4200] bg-[#ff9500]/15 rounded-xl px-3 py-2">
              {oldStock} auto{oldStock > 1 ? 's' : ''} con más de 60 días: conviene revisar el precio.
            </p>
          )}
          <div className="grid grid-cols-3 gap-2 mt-auto">
            {[
              { label: 'Publicados', n: vehiclesPub, to: '/vehiculos?status=publicado' },
              { label: 'En prep.', n: vehiclesPrep, to: '/vehiculos?status=preparacion' },
              { label: 'Vendidos', n: soldThisMonth.length, to: '/vehiculos?status=vendido' },
            ].map((t) => (
              <button key={t.label} onClick={() => navigate(t.to)} className="text-left bg-white/55 hover:bg-white/80 border border-white/70 rounded-2xl px-3 py-2.5 transition-colors">
                <p className="text-xs text-slate-600 truncate">{t.label}</p>
                <p className="text-[20px] font-bold text-slate-900">{t.n}</p>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Grouped lists */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <section className="xl:col-span-3 space-y-2">
          <div className="flex items-baseline px-1.5">
            <h2 className="flex-1 text-xl font-bold tracking-tight text-slate-900">Últimas ventas</h2>
            <button onClick={() => navigate('/vehiculos?status=vendido')} className="text-[15px] font-semibold text-brand-600 hover:opacity-70">Ver todas</button>
          </div>
          <div className="glass rounded-[22px] overflow-hidden">
            {recentSales.length === 0 && (
              <p className="px-5 py-6 text-sm text-slate-600 text-center">Todavía no hay ventas registradas.</p>
            )}
            {recentSales.map(({ sale, vehicle, client, profit }, i) => (
              <button
                key={sale.id}
                onClick={() => vehicle && navigate(`/vehiculos/${vehicle.id}`)}
                className="w-full flex items-center gap-3.5 pl-4 text-left hover:bg-white/40 transition-colors min-h-[64px]"
              >
                <span className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
                  <Car size={19} />
                </span>
                <span className={clsx('flex-1 min-w-0 self-stretch flex items-center gap-3 pr-4', i < recentSales.length - 1 && 'border-b border-brand-600/10')}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-slate-900 truncate">
                      {vehicle ? `${vehicle.brand} ${vehicle.model} ${vehicle.year}` : 'Vehículo'}
                    </span>
                    <span className="block text-[13px] text-slate-600 truncate">
                      {client ? `${client.firstName} ${client.lastName}` : 'Sin cliente'} · {formatDate(sale.saleDate)}
                    </span>
                  </span>
                  <span className="text-right flex-shrink-0">
                    <span className="block text-[15px] font-semibold text-slate-900">{formatCurrencyShort(sale.salePrice)}</span>
                    {profit !== null && (
                      <span className={clsx('block text-[13px] font-semibold', profit >= 0 ? 'text-[#1a6e34]' : 'text-[#c2000f]')}>
                        {profit >= 0 ? '+ ' : '− '}{formatCurrencyShort(Math.abs(profit))}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={16} className="text-slate-400 flex-shrink-0" strokeWidth={2.6} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="xl:col-span-2 space-y-2">
          <div className="flex items-baseline px-1.5">
            <h2 className="flex-1 text-xl font-bold tracking-tight text-slate-900">Próximos vencimientos</h2>
          </div>
          <div className="glass rounded-[22px] overflow-hidden">
            {dueItems.length === 0 && (
              <p className="px-5 py-6 text-sm text-slate-600 text-center">Nada vence en las próximas dos semanas.</p>
            )}
            {dueItems.map((d, i) => {
              const st = dueStatus(d.date);
              const Icon = d.icon;
              return (
                <button
                  key={d.key}
                  onClick={d.onClick}
                  className="w-full flex items-center gap-3.5 pl-4 text-left hover:bg-white/40 transition-colors min-h-[64px]"
                >
                  <span className={clsx('w-10 h-10 rounded-xl text-white flex items-center justify-center flex-shrink-0', st.tile)}>
                    <Icon size={18} />
                  </span>
                  <span className={clsx('flex-1 min-w-0 self-stretch flex items-center gap-3 pr-4', i < dueItems.length - 1 && 'border-b border-brand-600/10')}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-semibold text-slate-900 truncate">{d.title}</span>
                      <span className={clsx('block text-[13px]', st.sub)}>{st.text}</span>
                    </span>
                    <span className="text-[15px] font-semibold text-slate-900 flex-shrink-0">{d.amount}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Vehicles list */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-brand-600/10 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Vehículos activos</h3>
            <button onClick={() => navigate('/vehiculos')} className="text-sm font-semibold text-brand-600 hover:opacity-70">Ver todos</button>
          </div>
          <div className="divide-y divide-brand-600/10">
            {stockVehicles.slice(0, 5).map((v) => {
              const cost = expenses.filter((e) => e.vehicleId === v.id).reduce((a, e) => a + e.amount, 0);
              const invested = v.purchasePrice + cost;
              return (
                <div
                  key={v.id}
                  className="px-6 py-3 flex items-center gap-3 hover:bg-white/40 cursor-pointer transition-colors"
                  onClick={() => navigate(`/vehiculos/${v.id}`)}
                >
                  <div className="w-9 h-9 bg-white/70 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Car size={16} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{v.brand} {v.model} {v.year}</p>
                    <p className="text-xs text-slate-600">{v.patent} · Invertido: {formatCurrencyShort(invested)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[v.status]}`}>
                    {statusLabel[v.status]}
                  </span>
                </div>
              );
            })}
            {stockVehicles.length === 0 && (
              <p className="px-6 py-6 text-sm text-slate-600 text-center">Sin vehículos en stock</p>
            )}
          </div>
        </Card>

        {/* Tasks */}
        <Card padding={false}>
          <div className="px-6 py-4 border-b border-brand-600/10 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Tareas pendientes</h3>
            <button onClick={() => navigate('/tareas')} className="text-sm font-semibold text-brand-600 hover:opacity-70">Ver todas</button>
          </div>
          <div className="divide-y divide-brand-600/10">
            {pendingTasks.slice(0, 5).map((t) => {
              const veh = vehicles.find((v) => v.id === t.vehicleId);
              const cli = clients.find((c) => c.id === t.clientId);
              return (
                <div
                  key={t.id}
                  className="px-6 py-3 flex items-center gap-3 hover:bg-white/40 cursor-pointer transition-colors"
                  onClick={() => navigate('/tareas')}
                >
                  <CheckSquare size={16} className={
                    t.priority === 'alta' ? 'text-red-500' :
                    t.priority === 'media' ? 'text-amber-500' : 'text-slate-400'
                  } />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{t.title}</p>
                    <p className="text-xs text-slate-600">
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
              <p className="px-6 py-6 text-sm text-slate-600 text-center">Sin tareas pendientes</p>
            )}
          </div>
        </Card>
      </div>

      {/* Egresos del mes (expenses variables + transacciones egreso) */}
      {(() => {
        const categoryLabels: Record<string, string> = {
          mecanica: 'Mecánica', lavado: 'Lavado', pintura: 'Pintura', documentacion: 'Documentación',
          comision: 'Comisión', publicidad: 'Publicidad', combustible: 'Combustible',
          impuesto: 'Impuesto', otro: 'Otro',
          compra_vehiculo: 'Compra vehículo', gasto_vehiculo: 'Gasto preparación',
          gasto_fijo: 'Gasto fijo', proveedor: 'Proveedor', otro_egreso: 'Otro egreso',
          iibb: 'IIBB', monotributo: 'Monotributo', responsable_inscripto: 'Resp. Inscripto',
          autonomos: 'Autónomos', ganancias: 'Ganancias',
        };

        type EgresoItem = { key: string; description: string; category: string; amount: number; date: string; source: 'finanzas' | 'gasto' | 'impuesto' };

        const fromExpenses: EgresoItem[] = expenses
          .filter((e) => e.date.startsWith(thisMonth))
          .map((e) => ({ key: `e-${e.id}`, description: e.description, category: e.category, amount: e.amount, date: e.date, source: 'gasto' as const }));

        const fromTransactions: EgresoItem[] = transactions
          .filter((t) => t.type === 'egreso' && t.paid !== false && t.date.startsWith(thisMonth))
          .map((t) => ({ key: `t-${t.id}`, description: t.description, category: t.category, amount: t.amount, date: t.date, source: 'finanzas' as const }));

        const fromTaxPayments: EgresoItem[] = taxPayments
          .filter((t) => t.paid && t.paidDate?.startsWith(thisMonth))
          .map((t) => ({ key: `tp-${t.id}`, description: t.description, category: t.type, amount: t.amount, date: t.paidDate!, source: 'impuesto' as const }));

        const allEgresos = [...fromExpenses, ...fromTransactions, ...fromTaxPayments].sort((a, b) => b.date.localeCompare(a.date));
        const total = allEgresos.reduce((a, e) => a + e.amount, 0);

        return (
          <Card padding={false}>
            <div className="px-6 py-4 border-b border-brand-600/10 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Egresos del mes</h3>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">
                  Total: <span className="text-red-600 font-semibold">{formatCurrency(total)}</span>
                </span>
                <button onClick={() => navigate('/finanzas')} className="text-sm font-semibold text-brand-600 hover:opacity-70">Ver finanzas</button>
              </div>
            </div>
            <div className="divide-y divide-brand-600/10">
              {allEgresos.length === 0 && (
                <p className="px-6 py-6 text-sm text-slate-600 text-center">No hay egresos registrados para este mes.</p>
              )}
              {allEgresos.slice(0, 6).map((e) => (
                <div key={e.key} className="px-6 py-3 flex items-center gap-3 hover:bg-white/40 transition-colors">
                  <div className="w-8 h-8 bg-[#ff3b30]/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Receipt size={14} className="text-[#ff3b30]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{e.description}</p>
                    <p className="text-xs text-slate-600">{categoryLabels[e.category] ?? e.category} · {formatDate(e.date)}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(e.amount)}</p>
                </div>
              ))}
              {allEgresos.length > 6 && (
                <div className="px-6 py-3 text-center">
                  <button onClick={() => navigate('/finanzas')} className="text-sm font-semibold text-brand-600 hover:opacity-70">
                    Ver {allEgresos.length - 6} más →
                  </button>
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Gastos fijos del mes */}
      <Card padding={false}>
        <div className="px-6 py-4 border-b border-brand-600/10 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">Gastos fijos del mes</h3>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600">
              Pagado: <span className="text-green-700 font-semibold">
                {formatCurrency(fixedExpenseRecords.filter(r => r.month === thisMonth && r.paid).reduce((a, r) => a + r.amount, 0))}
              </span>
            </span>
            <span className="text-sm text-slate-600">
              Pendiente: <span className="text-red-600 font-semibold">
                {formatCurrency(pendingFixedExpenses.reduce((a, r) => a + r.amount, 0))}
              </span>
            </span>
            <button onClick={() => navigate('/gastos-fijos')} className="text-sm font-semibold text-brand-600 hover:opacity-70">Gestionar</button>
          </div>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 xl:grid-cols-4 gap-3">
          {fixedExpenseRecords.filter((r) => r.month === thisMonth).map((r) => (
            <div key={r.id} className={clsx('p-3 rounded-2xl border', r.paid ? 'bg-[#34c759]/10 border-[#34c759]/25' : 'bg-white/55 border-white/70')}>
              <p className="text-xs font-semibold text-slate-700 truncate">{r.typeName}</p>
              <p className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(r.amount)}</p>
              <p className={clsx('text-xs mt-1', r.paid ? 'text-green-700' : 'text-slate-600')}>
                {r.paid ? `Pagado ${formatDate(r.paidDate)}` : `Vence ${formatDate(r.dueDate)}`}
              </p>
            </div>
          ))}
          {fixedExpenseRecords.filter((r) => r.month === thisMonth).length === 0 && (
            <p className="col-span-full text-sm text-slate-600 py-2">No hay gastos fijos registrados para este mes.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
