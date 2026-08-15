import { useState } from 'react';
import jsPDF from 'jspdf';
import { Download, FileText } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { notify } from '../components/ui/Feedback';

const NAVY: [number, number, number] = [38, 46, 99];
const CONTACT_KEY = 'maja-quote-contact';

/** Rasteriza el logo blanco (SVG) a PNG nítido para meterlo en el PDF sobre el navy. */
async function loadLogoPng(): Promise<string | null> {
  try {
    const res = await fetch('/logo-full-white.svg');
    let svg = await res.text();
    if (!/<svg[^>]*\swidth=/.test(svg)) svg = svg.replace('<svg', '<svg width="1153" height="239"');
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('img')); img.src = url; });
      const canvas = document.createElement('canvas');
      canvas.width = 1153; canvas.height = 239;
      canvas.getContext('2d')!.drawImage(img, 0, 0, 1153, 239);
      return canvas.toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
  } catch { return null; }
}

const loadContact = () => {
  try { return { phone: '', instagram: '', ...JSON.parse(localStorage.getItem(CONTACT_KEY) || '{}') }; }
  catch { return { phone: '', instagram: '' }; }
};

export function Quotes() {
  const { vehicles } = useStore();
  const [contact, setContact] = useState(loadContact);
  const [auto, setAuto] = useState('');
  const [contenido, setContenido] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [generating, setGenerating] = useState(false);

  const stock = vehicles.filter((v) => v.status !== 'vendido');

  const saveContact = (patch: Partial<typeof contact>) => {
    const next = { ...contact, ...patch };
    setContact(next);
    localStorage.setItem(CONTACT_KEY, JSON.stringify(next));
  };

  const pickVehicle = (id: string) => {
    setVehicleId(id);
    const v = vehicles.find((x) => x.id === id);
    if (v) setAuto(`${v.brand} ${v.model}${v.year ? ' ' + v.year : ''}${v.km ? ' · ' + v.km.toLocaleString('es-AR') + ' km' : ''}`.trim());
  };

  const generate = async () => {
    if (!auto.trim() && !contenido.trim()) { notify('Escribí al menos el auto o el contenido de la cotización.', 'error'); return; }
    setGenerating(true);
    try {
      const logo = await loadLogoPng();
      const doc = new jsPDF();
      const W = 210;

      // ── Encabezado navy: logo + teléfono + Instagram ─────────────────────
      const headH = 46;
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, headH, 'F');
      if (logo) doc.addImage(logo, 'PNG', 14, 13, 64, 64 * 239 / 1153);
      else { doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.text('MAJA', 14, 28); }
      // Contacto a la derecha
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      let cy = 18;
      if (contact.phone.trim()) { doc.text(`Tel: ${contact.phone.trim()}`, W - 14, cy, { align: 'right' }); cy += 7; }
      if (contact.instagram.trim()) { doc.text(`IG: ${contact.instagram.trim()}`, W - 14, cy, { align: 'right' }); cy += 7; }

      // ── Fecha ────────────────────────────────────────────────────────────
      doc.setTextColor(120); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }), W - 14, headH + 10, { align: 'right' });

      let y = headH + 18;

      // ── Auto a vender (título) ───────────────────────────────────────────
      if (auto.trim()) {
        doc.setDrawColor(...NAVY); doc.setLineWidth(0.5);
        doc.line(14, y, W - 14, y);
        y += 9;
        doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
        const titleLines = doc.splitTextToSize(auto.trim(), W - 28);
        doc.text(titleLines, 14, y);
        y += titleLines.length * 8 + 4;
        doc.setDrawColor(...NAVY);
        doc.line(14, y, W - 14, y);
        y += 12;
      }

      // ── Contenido libre ──────────────────────────────────────────────────
      if (contenido.trim()) {
        doc.setTextColor(40); doc.setFont('helvetica', 'normal'); doc.setFontSize(12);
        const lines = doc.splitTextToSize(contenido.replace(/\r/g, ''), W - 28) as string[];
        for (const line of lines) {
          if (y > 282) { doc.addPage(); y = 20; }
          doc.text(line, 14, y);
          y += 7;
        }
      }

      const fileName = `cotizacion-${auto || 'maja'}-${new Date().toISOString().split('T')[0]}`
        .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
      doc.save(`${fileName}.pdf`);
      notify('Cotización generada.', 'success');
    } catch {
      notify('No se pudo generar el PDF. Probá de nuevo.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Cotizaciones</h1>
        <p className="text-slate-500 text-sm mt-0.5">Escribí la cotización a tu manera y generá el PDF con el logo de Maja para imprimir.</p>
      </div>

      {/* Encabezado: logo + contacto */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Encabezado (aparece arriba, con el logo) <span className="font-normal text-slate-400">· se guarda para la próxima</span></h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Tu teléfono / WhatsApp" value={contact.phone} onChange={(e) => saveContact({ phone: e.target.value })} placeholder="3400-000000" />
          <Input label="Instagram" value={contact.instagram} onChange={(e) => saveContact({ instagram: e.target.value })} placeholder="@majaautomotores" />
        </div>
      </Card>

      {/* Cuerpo de la cotización */}
      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">La cotización</h3>
        <Select
          label="Traer un auto de tu stock (opcional)"
          value={vehicleId}
          onChange={(e) => pickVehicle(e.target.value)}
          options={stock.map((v) => ({ value: v.id, label: `${v.brand} ${v.model} ${v.year || ''} — ${v.patent || 's/patente'}` }))}
          placeholder="Escribir a mano o elegir uno…"
        />
        <Input label="Auto a vender" value={auto} onChange={(e) => setAuto(e.target.value)} placeholder="Ej: Volkswagen Tera Comfortline 2026" />
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Contenido (escribí lo que quieras: precio, condiciones, financiación, garantía…)</label>
          <textarea
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600 font-mono"
            rows={12}
            value={contenido}
            onChange={(e) => setContenido(e.target.value)}
            placeholder={'Precio: $35.000.000\nIncluye transferencia.\nFinanciación: entrega $15.000.000 + 12 cuotas de $1.800.000.\nGarantía de motor y caja por 30 días.\n\n¡Consultanos!'}
          />
          <p className="text-[11px] text-slate-400 mt-1">Se respeta tal cual lo escribís, con los saltos de línea.</p>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={generate} disabled={generating}>
          {generating ? <><FileText size={16} /> Generando…</> : <><Download size={16} /> Generar PDF</>}
        </Button>
      </div>
    </div>
  );
}
