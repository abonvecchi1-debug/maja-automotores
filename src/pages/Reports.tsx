import { useState } from 'react';
import { Loader2, FileDown, TableIcon, TrendingUp, TrendingDown, DollarSign, ShoppingCart } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const TOKEN_KEY = 'maja-auth-token';
const getToken = () => localStorage.getItem(TOKEN_KEY);

interface Resumen {
  total_ventas: number;
  total_ingresos_finanzas: number;
  cantidad_ventas: number;
  costo_vehiculos_vendidos: number;
  utilidad_bruta: number;
  total_gastos_variables: number;
  total_gastos_fijos: number;
  total_egresos_finanzas: number;
  total_gastos: number;
  utilidad_neta: number;
  total_compras: number;
  cantidad_compras: number;
}

interface Venta {
  id: string; sale_date: string; sale_price: number; payment_type: string;
  brand: string; model: string; year: number; patent: string;
  purchase_price: number; client_name: string;
}
interface Compra {
  id: string; brand: string; model: string; year: number; patent: string;
  purchase_date: string; purchase_price: number; status: string;
}
interface Gasto {
  id: string; description: string; date: string; amount: number;
  category: string; paid: number; vehicle_name: string; supplier_name: string;
}
interface GastoFijo {
  id: string; type_name: string; month: string; amount: number;
  due_date: string; paid: number; paid_date: string;
}
interface Transaccion {
  id: string; description: string; date: string; amount: number; category: string;
}

interface BalanceData {
  periodo: { from: string; to: string };
  resumen: Resumen;
  ventas: Venta[];
  compras: Compra[];
  gastos: Gasto[];
  gastos_fijos: GastoFijo[];
  egresos_finanzas: Transaccion[];
  ingresos_finanzas: Transaccion[];
}

const ARS = (n: number) => '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl p-4 ${color}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <p className="text-sm text-gray-400 italic py-2">Sin registros en el período</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50">
            {headers.map((h) => <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-600 border-b border-gray-200">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 border-b border-gray-100 last:border-0">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-gray-700">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportPDF(data: BalanceData) {
  const { periodo, resumen, ventas, compras, gastos, gastos_fijos, egresos_finanzas, ingresos_finanzas } = data;
  const doc = new jsPDF();
  const NAVY = [38, 46, 99] as [number, number, number];

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('Balance General', 14, 18);
  doc.setFontSize(10);
  doc.text(`Período: ${periodo.from} al ${periodo.to}`, 14, 27);
  doc.text(`Generado: ${new Date().toLocaleDateString('es-AR')}`, 150, 27);

  doc.setTextColor(30);
  doc.setFontSize(13);
  doc.text('Resumen ejecutivo', 14, 46);

  autoTable(doc, {
    startY: 50,
    head: [['Concepto', 'Importe']],
    body: [
      ['Ingresos por ventas', ARS(resumen.total_ventas)],
      ...(resumen.total_ingresos_finanzas > 0 ? [['Otros ingresos (Finanzas)', ARS(resumen.total_ingresos_finanzas)]] : []),
      ['Costo de vehículos vendidos', ARS(resumen.costo_vehiculos_vendidos)],
      ['Utilidad bruta', ARS(resumen.utilidad_bruta)],
      ['Gastos variables', ARS(resumen.total_gastos_variables)],
      ['Gastos fijos', ARS(resumen.total_gastos_fijos)],
      ...(resumen.total_egresos_finanzas > 0 ? [['Egresos (Finanzas)', ARS(resumen.total_egresos_finanzas)]] : []),
      ['Total gastos', ARS(resumen.total_gastos)],
      ['UTILIDAD NETA', ARS(resumen.utilidad_neta)],
    ],
    headStyles: { fillColor: NAVY },
    bodyStyles: { fontSize: 10 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.row.index === 6) {
        data.cell.styles.fillColor = resumen.utilidad_neta >= 0 ? [220, 252, 231] : [254, 226, 226];
        data.cell.styles.textColor = resumen.utilidad_neta >= 0 ? [22, 101, 52] : [153, 27, 27];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 14, right: 14 },
  });

  let y = (doc as any).lastAutoTable.finalY + 12;

  const addSection = (title: string, head: string[], body: string[][]) => {
    if (y > 240) { doc.addPage(); y = 14; }
    doc.setFontSize(12); doc.setTextColor(30);
    doc.text(title, 14, y); y += 4;
    autoTable(doc, {
      startY: y, head: [head], body,
      headStyles: { fillColor: NAVY, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  };

  addSection(`Ventas (${ventas.length})`, ['Fecha', 'Vehículo', 'Cliente', 'Precio Venta', 'Costo', 'Ganancia'],
    ventas.map((v) => [v.sale_date, `${v.brand} ${v.model} ${v.year}`, v.client_name || '-',
      ARS(v.sale_price), ARS(v.purchase_price), ARS(v.sale_price - v.purchase_price)]));

  addSection(`Compras (${compras.length})`, ['Fecha', 'Vehículo', 'Patente', 'Precio Compra'],
    compras.map((c) => [c.purchase_date, `${c.brand} ${c.model} ${c.year}`, c.patent, ARS(c.purchase_price)]));

  addSection(`Gastos Variables (${gastos.length})`, ['Fecha', 'Descripción', 'Categoría', 'Monto'],
    gastos.map((g) => [g.date, g.description, g.category, ARS(g.amount)]));

  addSection(`Gastos Fijos (${gastos_fijos.length})`, ['Mes', 'Concepto', 'Monto', 'Pagado'],
    gastos_fijos.map((g) => [g.month, g.type_name, ARS(g.amount), g.paid ? 'Sí' : 'No']));

  if (egresos_finanzas.length > 0)
    addSection(`Egresos de Finanzas (${egresos_finanzas.length})`, ['Fecha', 'Descripción', 'Categoría', 'Monto'],
      egresos_finanzas.map((t) => [t.date, t.description, t.category, ARS(t.amount)]));

  if (ingresos_finanzas.length > 0)
    addSection(`Ingresos de Finanzas (${ingresos_finanzas.length})`, ['Fecha', 'Descripción', 'Categoría', 'Monto'],
      ingresos_finanzas.map((t) => [t.date, t.description, t.category, ARS(t.amount)]));

  doc.save(`balance-${periodo.from}-${periodo.to}.pdf`);
}

function exportExcel(data: BalanceData) {
  const { periodo, resumen, ventas, compras, gastos, gastos_fijos, egresos_finanzas, ingresos_finanzas } = data;
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
    { 'Concepto': 'Ingresos por ventas', 'Importe': resumen.total_ventas },
    { 'Concepto': 'Otros ingresos (Finanzas)', 'Importe': resumen.total_ingresos_finanzas },
    { 'Concepto': 'Costo vehículos vendidos', 'Importe': resumen.costo_vehiculos_vendidos },
    { 'Concepto': 'Utilidad bruta', 'Importe': resumen.utilidad_bruta },
    { 'Concepto': 'Gastos variables', 'Importe': resumen.total_gastos_variables },
    { 'Concepto': 'Gastos fijos', 'Importe': resumen.total_gastos_fijos },
    { 'Concepto': 'Egresos (Finanzas)', 'Importe': resumen.total_egresos_finanzas },
    { 'Concepto': 'Total gastos', 'Importe': resumen.total_gastos },
    { 'Concepto': 'UTILIDAD NETA', 'Importe': resumen.utilidad_neta },
    { 'Concepto': '---', 'Importe': '' },
    { 'Concepto': 'Total compras del período', 'Importe': resumen.total_compras },
    { 'Concepto': 'Cantidad de ventas', 'Importe': resumen.cantidad_ventas },
    { 'Concepto': 'Cantidad de compras', 'Importe': resumen.cantidad_compras },
  ]), 'Resumen');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ventas.map((v) => ({
    'Fecha': v.sale_date, 'Vehículo': `${v.brand} ${v.model} ${v.year}`,
    'Patente': v.patent, 'Cliente': v.client_name, 'Forma de pago': v.payment_type,
    'Precio venta': v.sale_price, 'Costo compra': v.purchase_price,
    'Ganancia': v.sale_price - v.purchase_price,
  }))), 'Ventas');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(compras.map((c) => ({
    'Fecha': c.purchase_date, 'Vehículo': `${c.brand} ${c.model} ${c.year}`,
    'Patente': c.patent, 'Estado': c.status, 'Precio compra': c.purchase_price,
  }))), 'Compras');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastos.map((g) => ({
    'Fecha': g.date, 'Descripción': g.description, 'Categoría': g.category,
    'Monto': g.amount, 'Vehículo': g.vehicle_name || '', 'Proveedor': g.supplier_name || '',
    'Pagado': g.paid ? 'Sí' : 'No',
  }))), 'Gastos Variables');

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastos_fijos.map((g) => ({
    'Mes': g.month, 'Concepto': g.type_name, 'Vencimiento': g.due_date,
    'Monto': g.amount, 'Pagado': g.paid ? 'Sí' : 'No', 'Fecha pago': g.paid_date || '',
  }))), 'Gastos Fijos');

  if (egresos_finanzas.length > 0)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(egresos_finanzas.map((t) => ({
      'Fecha': t.date, 'Descripción': t.description, 'Categoría': t.category, 'Monto': t.amount,
    }))), 'Egresos Finanzas');

  if (ingresos_finanzas.length > 0)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ingresos_finanzas.map((t) => ({
      'Fecha': t.date, 'Descripción': t.description, 'Categoría': t.category, 'Monto': t.amount,
    }))), 'Ingresos Finanzas');

  XLSX.writeFile(wb, `balance-${periodo.from}-${periodo.to}.xlsx`);
}

export function Reports() {
  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  const todayStr = today.toISOString().slice(0, 10);

  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(todayStr);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BalanceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/balance?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al generar el reporte');
    } finally {
      setLoading(false);
    }
  }

  const r = data?.resumen;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes y Balance</h1>
        <p className="text-gray-500 text-sm mt-1">Generá un balance completo del negocio para cualquier período.</p>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-[#262e63] hover:bg-[#1e2550] disabled:opacity-60 text-white font-semibold rounded-lg transition-colors">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <TrendingUp size={16} />}
            {loading ? 'Generando...' : 'Generar balance'}
          </button>
          {data && (
            <div className="flex gap-2 ml-auto">
              <button onClick={() => exportPDF(data)}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors">
                <FileDown size={15} /> PDF
              </button>
              <button onClick={() => exportExcel(data)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors">
                <TableIcon size={15} /> Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>}

      {r && data && (
        <div className="space-y-8">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Ingresos ventas" value={ARS(r.total_ventas)}
              sub={`${r.cantidad_ventas} venta${r.cantidad_ventas !== 1 ? 's' : ''}`}
              color="bg-blue-50 text-blue-900" />
            <StatCard label="Costo vehiculos" value={ARS(r.costo_vehiculos_vendidos)}
              color="bg-orange-50 text-orange-900" />
            <StatCard label="Total gastos" value={ARS(r.total_gastos)}
              sub={`Var: ${ARS(r.total_gastos_variables)} · Fijos: ${ARS(r.total_gastos_fijos)}`}
              color="bg-red-50 text-red-900" />
            <StatCard
              label="Utilidad neta"
              value={ARS(r.utilidad_neta)}
              color={r.utilidad_neta >= 0 ? 'bg-green-50 text-green-900' : 'bg-red-100 text-red-900'}
            />
          </div>

          {/* Utilidad bruta */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Estructura del resultado</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Ingresos por ventas', val: r.total_ventas, bold: false, positive: true },
                ...(r.total_ingresos_finanzas > 0 ? [{ label: '(+) Otros ingresos (Finanzas)', val: r.total_ingresos_finanzas, bold: false, positive: true }] : []),
                { label: '(-) Costo vehículos vendidos', val: -r.costo_vehiculos_vendidos, bold: false, positive: false },
                { label: 'Utilidad bruta', val: r.utilidad_bruta, bold: true, positive: r.utilidad_bruta >= 0 },
                { label: '(-) Gastos variables', val: -r.total_gastos_variables, bold: false, positive: false },
                { label: '(-) Gastos fijos', val: -r.total_gastos_fijos, bold: false, positive: false },
                ...(r.total_egresos_finanzas > 0 ? [{ label: '(-) Egresos (Finanzas)', val: -r.total_egresos_finanzas, bold: false, positive: false }] : []),
                { label: 'UTILIDAD NETA', val: r.utilidad_neta, bold: true, positive: r.utilidad_neta >= 0 },
              ].map((row, i, arr) => (
                <div key={i} className={`flex justify-between py-1.5 ${(row.label === 'Utilidad bruta' || row.label === 'UTILIDAD NETA') ? 'border-t border-gray-200 mt-1 pt-2' : ''}`}>
                  <span className={row.bold ? 'font-bold text-gray-800' : 'text-gray-600'}>{row.label}</span>
                  <span className={`font-semibold ${row.bold ? (row.positive ? 'text-green-700' : 'text-red-700') : 'text-gray-700'}`}>
                    {ARS(row.val)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tablas detalle */}
          <Section title={`Ventas (${data.ventas.length})`}>
            <SimpleTable
              headers={['Fecha', 'Vehículo', 'Cliente', 'Precio venta', 'Costo', 'Ganancia']}
              rows={data.ventas.map((v) => [
                v.sale_date, `${v.brand} ${v.model} ${v.year}`, v.client_name || '-',
                ARS(v.sale_price), ARS(v.purchase_price), ARS(v.sale_price - v.purchase_price),
              ])}
            />
          </Section>

          <Section title={`Compras (${data.compras.length})`}>
            <SimpleTable
              headers={['Fecha', 'Vehículo', 'Patente', 'Precio compra']}
              rows={data.compras.map((c) => [
                c.purchase_date, `${c.brand} ${c.model} ${c.year}`, c.patent, ARS(c.purchase_price),
              ])}
            />
          </Section>

          <Section title={`Gastos variables (${data.gastos.length})`}>
            <SimpleTable
              headers={['Fecha', 'Descripción', 'Categoría', 'Monto']}
              rows={data.gastos.map((g) => [g.date, g.description, g.category, ARS(g.amount)])}
            />
          </Section>

          <Section title={`Gastos fijos (${data.gastos_fijos.length})`}>
            <SimpleTable
              headers={['Mes', 'Concepto', 'Monto', 'Pagado']}
              rows={data.gastos_fijos.map((g) => [g.month, g.type_name, ARS(g.amount), g.paid ? 'Sí' : 'No'])}
            />
          </Section>

          <Section title={`Egresos de Finanzas (${data.egresos_finanzas.length})`}>
            <SimpleTable
              headers={['Fecha', 'Descripción', 'Categoría', 'Monto']}
              rows={data.egresos_finanzas.map((t) => [t.date, t.description, t.category, ARS(t.amount)])}
            />
          </Section>

          {data.ingresos_finanzas.length > 0 && (
            <Section title={`Ingresos de Finanzas (${data.ingresos_finanzas.length})`}>
              <SimpleTable
                headers={['Fecha', 'Descripción', 'Categoría', 'Monto']}
                rows={data.ingresos_finanzas.map((t) => [t.date, t.description, t.category, ARS(t.amount)])}
              />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
