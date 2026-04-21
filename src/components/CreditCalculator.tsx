import { useState, useMemo } from 'react';
import { Plus, X, ChevronDown, ChevronUp, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type TasaTipo = 'mensual' | 'anual_nominal' | 'anual_efectiva';
type ValorTipo = 'porcentaje' | 'monto';

interface ScenarioInput {
  nombre: string;
  precioVehiculo: string;
  anticipo: string;
  usarMontoManual: boolean;
  montoManual: string;
  tasa: string;
  tipoTasa: TasaTipo;
  plazo: string;
  tieneQuebranto: boolean;
  quebrantoTipo: ValorTipo;
  quebrantoValor: string;
  tieneGastos: boolean;
  gastosTipo: ValorTipo;
  gastosValor: string;
}

interface AmortRow {
  periodo: number;
  cuota: number;
  interes: number;
  capital: number;
  saldo: number;
}

interface CalcResult {
  montoFinanciado: number;
  tasaMensual: number;
  cuotaMensual: number;
  totalAPagar: number;
  interesTotal: number;
  montoRetenido: number;
  montoRealCliente: number;
  gastosAdminMonto: number;
  gananciaFinanciera: number;
  cftMensual: number | null;
  cftAnual: number | null;
  amortizacion: AmortRow[];
}

/* ─── Pure helpers ───────────────────────────────────────────────────────── */

function $n(n: number, d = 0) {
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function tn(n: number, d = 2) {
  return n.toFixed(d) + '%';
}

function pf(s: string) {
  return parseFloat(s) || 0;
}

function defaultScenario(nombre: string): ScenarioInput {
  return {
    nombre,
    precioVehiculo: '',
    anticipo: '',
    usarMontoManual: false,
    montoManual: '',
    tasa: '',
    tipoTasa: 'anual_nominal',
    plazo: '24',
    tieneQuebranto: false,
    quebrantoTipo: 'porcentaje',
    quebrantoValor: '',
    tieneGastos: false,
    gastosTipo: 'porcentaje',
    gastosValor: '',
  };
}

function calcular(s: ScenarioInput): CalcResult | null {
  const montoFinanciado = s.usarMontoManual
    ? pf(s.montoManual)
    : pf(s.precioVehiculo) - pf(s.anticipo);

  if (montoFinanciado <= 0) return null;

  const tasaRaw = pf(s.tasa);
  // tasaRaw = 0 is valid (0% interest — cuota = capital / n)

  const n = Math.round(pf(s.plazo));
  if (n <= 0) return null;

  let r: number;
  if (s.tipoTasa === 'mensual') r = tasaRaw / 100;
  else if (s.tipoTasa === 'anual_nominal') r = tasaRaw / 100 / 12;
  else r = Math.pow(1 + tasaRaw / 100, 1 / 12) - 1;

  // French system: when r=0 cuota = P/n, otherwise use standard formula
  const cuota = r === 0
    ? montoFinanciado / n
    : montoFinanciado * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalAPagar = cuota * n;
  const interesTotal = totalAPagar - montoFinanciado;

  const qVal = pf(s.quebrantoValor);
  const montoRetenido = s.tieneQuebranto
    ? (s.quebrantoTipo === 'porcentaje' ? montoFinanciado * qVal / 100 : qVal)
    : 0;
  const montoRealCliente = montoFinanciado - montoRetenido;

  const gVal = pf(s.gastosValor);
  const gastosAdminMonto = s.tieneGastos
    ? (s.gastosTipo === 'porcentaje' ? montoFinanciado * gVal / 100 : gVal)
    : 0;

  const gananciaFinanciera = interesTotal + montoRetenido + gastosAdminMonto;

  // CFT: find monthly r such that PV of annuity = effective capital received
  const capitalEfectivo = montoRealCliente - gastosAdminMonto;
  let cftMensual: number | null = null;
  let cftAnual: number | null = null;
  if (capitalEfectivo > 0) {
    let lo = 0.00001, hi = 2.0;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      const pv = cuota * (1 - Math.pow(1 + mid, -n)) / mid;
      if (pv > capitalEfectivo) lo = mid;
      else hi = mid;
    }
    cftMensual = (lo + hi) / 2;
    cftAnual = Math.pow(1 + cftMensual, 12) - 1;
  }

  const amortizacion: AmortRow[] = [];
  let saldo = montoFinanciado;
  for (let i = 1; i <= n; i++) {
    const interes = saldo * r;
    const capital = cuota - interes;
    saldo = Math.max(0, saldo - capital);
    amortizacion.push({ periodo: i, cuota, interes, capital, saldo });
  }

  return {
    montoFinanciado,
    tasaMensual: r,
    cuotaMensual: cuota,
    totalAPagar,
    interesTotal,
    montoRetenido,
    montoRealCliente,
    gastosAdminMonto,
    gananciaFinanciera,
    cftMensual,
    cftAnual,
    amortizacion,
  };
}

/* ─── UI primitives ──────────────────────────────────────────────────────── */

const iCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white';

function FL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-1 pb-2 border-t border-gray-100 mt-1">
      {title}
    </p>
  );
}

/* ─── Scenario form ──────────────────────────────────────────────────────── */

function ScenarioForm({
  value,
  onChange,
}: {
  value: ScenarioInput;
  onChange: (v: ScenarioInput) => void;
}) {
  function set<K extends keyof ScenarioInput>(key: K, val: ScenarioInput[K]) {
    onChange({ ...value, [key]: val });
  }

  const montoDerivado = pf(value.precioVehiculo) - pf(value.anticipo);

  return (
    <div className="space-y-4">
      <FL label="Nombre del escenario">
        <input
          className={iCls}
          value={value.nombre}
          onChange={(e) => set('nombre', e.target.value)}
        />
      </FL>

      <SectionLabel title="Capital" />

      <div className="grid grid-cols-2 gap-3">
        <FL label="Precio del vehículo ($)">
          <input
            className={iCls}
            type="number"
            min="0"
            value={value.precioVehiculo}
            onChange={(e) => set('precioVehiculo', e.target.value)}
            placeholder="0"
          />
        </FL>
        <FL label="Anticipo ($) — opcional">
          <input
            className={iCls}
            type="number"
            min="0"
            value={value.anticipo}
            onChange={(e) => set('anticipo', e.target.value)}
            placeholder="0"
          />
        </FL>
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={value.usarMontoManual}
          onChange={(e) => set('usarMontoManual', e.target.checked)}
          className="rounded border-gray-300 text-blue-500"
        />
        Ingresar monto a financiar manualmente
      </label>

      {value.usarMontoManual ? (
        <FL label="Monto a financiar ($)">
          <input
            className={iCls}
            type="number"
            min="0"
            value={value.montoManual}
            onChange={(e) => set('montoManual', e.target.value)}
            placeholder="0"
          />
        </FL>
      ) : montoDerivado > 0 ? (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
          <span className="text-xs text-blue-500 font-medium">Monto a financiar</span>
          <span className="text-sm font-bold text-blue-800">{$n(montoDerivado)}</span>
        </div>
      ) : null}

      <SectionLabel title="Condiciones del crédito" />

      <div className="grid grid-cols-2 gap-3">
        <FL label="Tasa de interés">
          <input
            className={iCls}
            type="number"
            min="0"
            step="0.01"
            value={value.tasa}
            onChange={(e) => set('tasa', e.target.value)}
            placeholder="0.00"
          />
        </FL>
        <FL label="Tipo de tasa">
          <select
            className={iCls}
            value={value.tipoTasa}
            onChange={(e) => set('tipoTasa', e.target.value as TasaTipo)}
          >
            <option value="anual_nominal">TNA — % anual nominal</option>
            <option value="anual_efectiva">TEA — % anual efectiva</option>
            <option value="mensual">% mensual</option>
          </select>
        </FL>
        <FL label="Plazo (cuotas)">
          <input
            className={iCls}
            type="number"
            min="1"
            max="360"
            value={value.plazo}
            onChange={(e) => set('plazo', e.target.value)}
            placeholder="24"
          />
        </FL>
      </div>

      <SectionLabel title="Costos adicionales" />

      {/* Quebranto */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value.tieneQuebranto}
            onChange={(e) => set('tieneQuebranto', e.target.checked)}
            className="rounded border-gray-300 text-blue-500"
          />
          <span className="font-medium">Quebranto</span>
          <span className="text-xs text-gray-400 hidden sm:inline">
            (retención financiera sobre capital nominal)
          </span>
        </label>
        {value.tieneQuebranto && (
          <div className="grid grid-cols-2 gap-3 pl-5 pt-1">
            <FL label="Tipo">
              <select
                className={iCls}
                value={value.quebrantoTipo}
                onChange={(e) => set('quebrantoTipo', e.target.value as ValorTipo)}
              >
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto">Monto fijo ($)</option>
              </select>
            </FL>
            <FL label={value.quebrantoTipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto ($)'}>
              <input
                className={iCls}
                type="number"
                min="0"
                step="0.01"
                value={value.quebrantoValor}
                onChange={(e) => set('quebrantoValor', e.target.value)}
                placeholder="0"
              />
            </FL>
          </div>
        )}
      </div>

      {/* Gastos admin */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value.tieneGastos}
            onChange={(e) => set('tieneGastos', e.target.checked)}
            className="rounded border-gray-300 text-blue-500"
          />
          <span className="font-medium">Gastos admin / Comisiones</span>
        </label>
        {value.tieneGastos && (
          <div className="grid grid-cols-2 gap-3 pl-5 pt-1">
            <FL label="Tipo">
              <select
                className={iCls}
                value={value.gastosTipo}
                onChange={(e) => set('gastosTipo', e.target.value as ValorTipo)}
              >
                <option value="porcentaje">Porcentaje (%)</option>
                <option value="monto">Monto fijo ($)</option>
              </select>
            </FL>
            <FL label={value.gastosTipo === 'porcentaje' ? 'Porcentaje (%)' : 'Monto ($)'}>
              <input
                className={iCls}
                type="number"
                min="0"
                step="0.01"
                value={value.gastosValor}
                onChange={(e) => set('gastosValor', e.target.value)}
                placeholder="0"
              />
            </FL>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Result panel ───────────────────────────────────────────────────────── */

function Metric({
  label,
  value,
  big,
  highlight,
  sub,
}: {
  label: string;
  value: string;
  big?: boolean;
  highlight?: boolean;
  sub?: string;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${highlight ? 'text-white' : 'bg-gray-50 border border-gray-100'}`}
      style={highlight ? { backgroundColor: '#262e63' } : undefined}
    >
      <p className={`text-xs mb-0.5 ${highlight ? 'text-white/70' : 'text-gray-500'}`}>{label}</p>
      <p
        className={`font-bold ${big ? 'text-2xl' : 'text-base'} ${highlight ? 'text-white' : 'text-gray-900'}`}
      >
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-0.5 ${highlight ? 'text-white/60' : 'text-gray-400'}`}>{sub}</p>
      )}
    </div>
  );
}

function ResultPanel({ r }: { r: CalcResult }) {
  const [showAmort, setShowAmort] = useState(false);

  return (
    <div className="space-y-4">
      <Metric
        label="Cuota mensual (sistema francés)"
        value={$n(r.cuotaMensual, 2)}
        big
        highlight
        sub={`${r.amortizacion.length} cuotas — plazo ${r.amortizacion.length} meses`}
      />

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Capital nominal" value={$n(r.montoFinanciado)} />
        <Metric label="Total a pagar" value={$n(r.totalAPagar)} />
        <Metric
          label="Interés total"
          value={$n(r.interesTotal)}
          sub={tn((r.interesTotal / r.montoFinanciado) * 100) + ' sobre capital'}
        />
        <Metric label="Cliente recibe" value={$n(r.montoRealCliente)} />
        {r.montoRetenido > 0 && (
          <Metric
            label="Quebranto retenido"
            value={$n(r.montoRetenido)}
            sub={tn((r.montoRetenido / r.montoFinanciado) * 100) + ' del nominal'}
          />
        )}
        {r.gastosAdminMonto > 0 && (
          <Metric label="Gastos administrativos" value={$n(r.gastosAdminMonto)} />
        )}
        <Metric
          label="Ganancia financiera total"
          value={$n(r.gananciaFinanciera)}
          sub={tn((r.gananciaFinanciera / r.montoFinanciado) * 100) + ' sobre capital'}
        />
        {r.cftAnual != null && (
          <Metric
            label="CFT anual (aprox.)"
            value={tn(r.cftAnual * 100)}
            sub={`CFT mensual: ${tn(r.cftMensual! * 100)}`}
          />
        )}
      </div>

      <button
        onClick={() => setShowAmort(!showAmort)}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
      >
        {showAmort ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {showAmort ? 'Ocultar' : 'Ver'} tabla de amortización ({r.amortizacion.length} cuotas)
      </button>

      {showAmort && (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: '#262e63' }}>
                {['#', 'Cuota', 'Interés', 'Capital', 'Saldo'].map((h) => (
                  <th key={h} className="text-left px-3 py-2 text-white font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.amortizacion.map((row, i) => (
                <tr key={row.periodo} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-1.5 font-medium text-gray-500">{row.periodo}</td>
                  <td className="px-3 py-1.5 text-gray-800">{$n(row.cuota, 2)}</td>
                  <td className="px-3 py-1.5 text-red-500">{$n(row.interes, 2)}</td>
                  <td className="px-3 py-1.5 text-green-600">{$n(row.capital, 2)}</td>
                  <td className="px-3 py-1.5 font-medium text-gray-700">{$n(row.saldo, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Comparison table ───────────────────────────────────────────────────── */

function CompareTable({
  scenarios,
  results,
}: {
  scenarios: ScenarioInput[];
  results: (CalcResult | null)[];
}) {
  const [r1, r2] = results;
  if (!r1 || !r2) return null;

  const rows: [string, string, string][] = [
    ['Capital nominal', $n(r1.montoFinanciado), $n(r2.montoFinanciado)],
    ['Cuota mensual', $n(r1.cuotaMensual, 2), $n(r2.cuotaMensual, 2)],
    ['Total a pagar', $n(r1.totalAPagar), $n(r2.totalAPagar)],
    ['Interés total', $n(r1.interesTotal), $n(r2.interesTotal)],
    ['Cliente recibe', $n(r1.montoRealCliente), $n(r2.montoRealCliente)],
    ['Quebranto retenido', $n(r1.montoRetenido), $n(r2.montoRetenido)],
    ['Gastos admin', $n(r1.gastosAdminMonto), $n(r2.gastosAdminMonto)],
    ['Ganancia financiera', $n(r1.gananciaFinanciera), $n(r2.gananciaFinanciera)],
    ...(r1.cftAnual != null && r2.cftAnual != null
      ? ([['CFT anual', tn(r1.cftAnual * 100), tn(r2.cftAnual * 100)]] as [string, string, string][])
      : []),
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3" style={{ backgroundColor: '#262e63' }}>
        <h3 className="font-semibold text-white text-sm">Comparación de escenarios</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-gray-400 font-medium w-1/3">Concepto</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-800">
                {scenarios[0].nombre}
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-800">
                {scenarios[1].nombre}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, v1, v2], i) => (
              <tr key={label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-2.5 text-gray-500">{label}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{v1}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{v2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── PDF export ─────────────────────────────────────────────────────────── */

function exportCalcPDF(scenarios: ScenarioInput[], results: (CalcResult | null)[]) {
  const doc = new jsPDF();
  const navy = [38, 46, 99] as [number, number, number];

  doc.setFillColor(38, 46, 99);
  doc.rect(0, 0, 210, 26, 'F');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('Simulación de Financiamiento Vehicular', 14, 14);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generado: ${new Date().toLocaleDateString('es-AR')} — Maja Automotores`,
    14,
    22,
  );

  let y = 34;

  scenarios.forEach((s, idx) => {
    const r = results[idx];
    if (!r) return;
    if (y > 230) { doc.addPage(); y = 20; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(38, 46, 99);
    doc.text(s.nombre, 14, y);
    y += 7;

    const params: [string, string][] = [
      ['Monto financiado', $n(r.montoFinanciado)],
      [
        'Tasa',
        `${s.tasa}% ${s.tipoTasa === 'mensual' ? 'mensual' : s.tipoTasa === 'anual_nominal' ? 'TNA' : 'TEA'}`,
      ],
      ['Plazo', `${s.plazo} cuotas`],
    ];
    if (s.tieneQuebranto)
      params.push([
        'Quebranto',
        s.quebrantoTipo === 'porcentaje' ? `${s.quebrantoValor}%` : $n(pf(s.quebrantoValor)),
      ]);
    if (s.tieneGastos)
      params.push([
        'Gastos admin',
        s.gastosTipo === 'porcentaje' ? `${s.gastosValor}%` : $n(pf(s.gastosValor)),
      ]);

    autoTable(doc, {
      startY: y,
      body: params,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { textColor: [120, 120, 120] as [number, number, number], cellWidth: 55 },
        1: { fontStyle: 'bold', textColor: [30, 30, 30] as [number, number, number] },
      },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

    const resultRows: [string, string][] = [
      ['Cuota mensual', $n(r.cuotaMensual, 2)],
      ['Total a pagar', $n(r.totalAPagar)],
      [
        'Interés total',
        `${$n(r.interesTotal)} (${tn((r.interesTotal / r.montoFinanciado) * 100)})`,
      ],
      ['Cliente recibe', $n(r.montoRealCliente)],
    ];
    if (r.montoRetenido > 0) resultRows.push(['Quebranto retenido', $n(r.montoRetenido)]);
    if (r.gastosAdminMonto > 0) resultRows.push(['Gastos admin', $n(r.gastosAdminMonto)]);
    resultRows.push(['Ganancia financiera', $n(r.gananciaFinanciera)]);
    if (r.cftAnual != null) resultRows.push(['CFT anual (aprox.)', tn(r.cftAnual * 100)]);

    autoTable(doc, {
      startY: y,
      head: [['Concepto', 'Valor']],
      body: resultRows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: navy },
      margin: { left: 14, right: 14 },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

    if (r.amortizacion.length <= 72) {
      if (y > 200) { doc.addPage(); y = 20; }
      autoTable(doc, {
        startY: y,
        head: [['#', 'Cuota', 'Interés', 'Capital', 'Saldo']],
        body: r.amortizacion.map((row) => [
          row.periodo,
          $n(row.cuota, 2),
          $n(row.interes, 2),
          $n(row.capital, 2),
          $n(row.saldo, 2),
        ]),
        styles: { fontSize: 7.5 },
        headStyles: { fillColor: navy },
        margin: { left: 14, right: 14 },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    } else {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.setFont('helvetica', 'italic');
      doc.text(
        `Tabla de amortización no incluida en PDF (${r.amortizacion.length} cuotas). Ver desde la app.`,
        14,
        y,
      );
      y += 12;
    }
  });

  doc.save('simulacion-financiamiento.pdf');
}

/* ─── Main component ─────────────────────────────────────────────────────── */

export function CreditCalculator() {
  const [scenarios, setScenarios] = useState<ScenarioInput[]>([
    defaultScenario('Escenario 1'),
    defaultScenario('Escenario 2'),
  ]);
  const [showSecond, setShowSecond] = useState(false);

  const results = useMemo(() => scenarios.map(calcular), [scenarios]);
  const r1 = results[0];
  const r2 = results[1];

  function update(idx: number, val: ScenarioInput) {
    setScenarios((prev) => prev.map((s, i) => (i === idx ? val : s)));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Calculadora de Financiamiento</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Sistema francés · cuota fija · cálculo en tiempo real
          </p>
        </div>
        <button
          onClick={() =>
            exportCalcPDF(
              showSecond ? scenarios : [scenarios[0]],
              showSecond ? results : [results[0]],
            )
          }
          disabled={!r1}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors flex-shrink-0"
        >
          <FileDown size={15} /> PDF
        </button>
      </div>

      {/* Scenario grid */}
      <div className={`grid gap-6 items-start ${showSecond ? 'lg:grid-cols-2' : ''}`}>
        {/* Scenario 1 */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <ScenarioForm value={scenarios[0]} onChange={(v) => update(0, v)} />
          </div>
          {r1 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <ResultPanel r={r1} />
            </div>
          )}
        </div>

        {/* Scenario 2 */}
        {showSecond && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">Segundo escenario</span>
                <button
                  onClick={() => setShowSecond(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
              <ScenarioForm value={scenarios[1]} onChange={(v) => update(1, v)} />
            </div>
            {r2 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <ResultPanel r={r2} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add second scenario */}
      {!showSecond && (
        <button
          onClick={() => setShowSecond(true)}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          <Plus size={14} /> Comparar con otro escenario
        </button>
      )}

      {/* Comparison table — only when both scenarios have results */}
      {showSecond && r1 && r2 && <CompareTable scenarios={scenarios} results={results} />}
    </div>
  );
}
