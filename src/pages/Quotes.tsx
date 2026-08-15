import { useState } from 'react';
import jsPDF from 'jspdf';
import { FileText, Download, Car } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { notify } from '../components/ui/Feedback';
import { formatCurrency } from '../utils/formatters';

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
  try { return { phone: '', instagram: '', address: '', ...JSON.parse(localStorage.getItem(CONTACT_KEY) || '{}') }; }
  catch { return { phone: '', instagram: '', address: '' }; }
};

const emptyForm = {
  vehicleId: '',
  brand: '', model: '', year: new Date().getFullYear(), km: 0, color: '', patent: '',
  clientName: '',
  price: 0,
  financiar: false, entrega: 0, cuotas: 12, valorCuota: 0,
  validezDias: 7,
  observaciones: 'Precio de contado. Incluye transferencia. Sujeto a disponibilidad.',
};

export function Quotes() {
  const { vehicles } = useStore();
  const [form, setForm] = useState(emptyForm);
  const [contact, setContact] = useState(loadContact);
  const [generating, setGenerating] = useState(false);

  const stock = vehicles.filter((v) => v.status !== 'vendido');
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const pickVehicle = (id: string) => {
    const v = vehicles.find((x) => x.id === id);
    if (!v) { set({ vehicleId: '' }); return; }
    set({
      vehicleId: id, brand: v.brand, model: v.model, year: v.year, km: v.km, color: v.color, patent: v.patent,
      price: v.publishPrice || form.price,
    });
  };

  const cuotaSugerida = form.financiar && form.cuotas > 0 ? Math.max(0, form.price - form.entrega) / form.cuotas : 0;

  const saveContact = (patch: Partial<typeof contact>) => {
    const next = { ...contact, ...patch };
    setContact(next);
    localStorage.setItem(CONTACT_KEY, JSON.stringify(next));
  };

  const generate = async () => {
    if (!form.brand.trim() || !form.model.trim()) { notify('Cargá al menos marca y modelo del vehículo.', 'error'); return; }
    if (!form.price || form.price <= 0) { notify('Poné el precio.', 'error'); return; }
    setGenerating(true);
    try {
      const logo = await loadLogoPng();
      const doc = new jsPDF();
      const W = 210;
      const money = (n: number) => '$ ' + Math.round(n).toLocaleString('es-AR');

      // ── Encabezado navy con logo ─────────────────────────────────────────
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 42, 'F');
      if (logo) doc.addImage(logo, 'PNG', 14, 12, 62, 62 * 239 / 1153);
      else { doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.text('MAJA', 14, 26); }
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text('COTIZACIÓN', W - 14, 18, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }), W - 14, 26, { align: 'right' });
      doc.text(`Válida por ${form.validezDias} día${form.validezDias === 1 ? '' : 's'}`, W - 14, 32, { align: 'right' });

      let y = 58;
      // ── Cliente ──────────────────────────────────────────────────────────
      if (form.clientName.trim()) {
        doc.setTextColor(120); doc.setFontSize(9); doc.text('PARA', 14, y);
        doc.setTextColor(30); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
        doc.text(form.clientName.trim(), 14, y + 7);
        y += 18;
      }

      // ── Vehículo (caja) ──────────────────────────────────────────────────
      doc.setDrawColor(...NAVY); doc.setLineWidth(0.4);
      doc.setFillColor(244, 246, 252);
      doc.roundedRect(14, y, W - 28, 34, 2, 2, 'FD');
      doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
      doc.text('VEHÍCULO', 20, y + 8);
      doc.setTextColor(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      doc.text(`${form.brand} ${form.model}${form.year ? ' ' + form.year : ''}`.trim(), 20, y + 17);
      doc.setTextColor(90); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const detalles = [
        form.km ? `${form.km.toLocaleString('es-AR')} km` : '',
        form.color ? `Color: ${form.color}` : '',
        form.patent ? `Patente: ${form.patent}` : '',
      ].filter(Boolean).join('     ');
      if (detalles) doc.text(detalles, 20, y + 27);
      y += 44;

      // ── Precio (destacado) ───────────────────────────────────────────────
      doc.setFillColor(...NAVY);
      doc.roundedRect(14, y, W - 28, 22, 2, 2, 'F');
      doc.setTextColor(210, 216, 240); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text('PRECIO', 20, y + 9);
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
      doc.text(money(form.price), W - 20, y + 15, { align: 'right' });
      y += 32;

      // ── Financiación (opcional) ──────────────────────────────────────────
      if (form.financiar) {
        const cuota = form.valorCuota > 0 ? form.valorCuota : cuotaSugerida;
        doc.setDrawColor(...NAVY); doc.setFillColor(255, 255, 255);
        doc.roundedRect(14, y, W - 28, 26, 2, 2, 'FD');
        doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.text('FINANCIACIÓN', 20, y + 8);
        doc.setTextColor(30); doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
        doc.text(`Entrega de ${money(form.entrega)}`, 20, y + 17);
        doc.setFont('helvetica', 'bold');
        doc.text(`+ ${form.cuotas} cuotas de ${money(cuota)}`, 20, y + 23);
        y += 36;
      }

      // ── Observaciones ────────────────────────────────────────────────────
      if (form.observaciones.trim()) {
        doc.setTextColor(110); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
        const lines = doc.splitTextToSize(form.observaciones.trim(), W - 28);
        doc.text(lines, 14, y);
      }

      // ── Pie navy con contacto ────────────────────────────────────────────
      const footY = 277;
      doc.setFillColor(...NAVY);
      doc.rect(0, footY, W, 20, 'F');
      doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
      doc.text('MAJA AUTOMOTORES', 14, footY + 9);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      const contactLine = [
        contact.phone ? `Tel: ${contact.phone}` : '',
        contact.instagram ? `IG: ${contact.instagram}` : '',
        contact.address || '',
      ].filter(Boolean).join('    ');
      if (contactLine) doc.text(contactLine, 14, footY + 15);
      doc.setTextColor(200, 208, 235);
      doc.text('¡Gracias por tu consulta!', W - 14, footY + 12, { align: 'right' });

      const fileName = `cotizacion-${form.brand}-${form.model}-${new Date().toISOString().split('T')[0]}`
        .toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      doc.save(`${fileName}.pdf`);
      notify('Cotización generada.', 'success');
    } catch (err) {
      notify('No se pudo generar el PDF. Probá de nuevo.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Cotizaciones</h1>
        <p className="text-slate-500 text-sm mt-0.5">Armá una cotización y generá un PDF con el logo de Maja para imprimir.</p>
      </div>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Vehículo</h3>
        <Select
          label="Elegir de tu stock (opcional)"
          value={form.vehicleId}
          onChange={(e) => pickVehicle(e.target.value)}
          options={stock.map((v) => ({ value: v.id, label: `${v.brand} ${v.model} ${v.year || ''} — ${v.patent || 's/patente'}` }))}
          placeholder="Cargar a mano o elegir uno…"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Marca" value={form.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Volkswagen" />
          <Input label="Modelo" value={form.model} onChange={(e) => set({ model: e.target.value })} placeholder="Tera Comfortline" />
          <Input label="Año" type="number" value={form.year || ''} onChange={(e) => set({ year: +e.target.value })} />
          <Input label="Kilómetros" type="number" value={form.km || ''} onChange={(e) => set({ km: +e.target.value })} />
          <Input label="Color" value={form.color} onChange={(e) => set({ color: e.target.value })} placeholder="Blanco" />
          <Input label="Patente" value={form.patent} onChange={(e) => set({ patent: e.target.value })} placeholder="AB123CD" />
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Precio y condiciones</h3>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Precio ($)" type="number" value={form.price || ''} onChange={(e) => set({ price: +e.target.value })} placeholder="35000000" />
          <Input label="Cliente (opcional)" value={form.clientName} onChange={(e) => set({ clientName: e.target.value })} placeholder="Nombre del cliente" />
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.financiar} onChange={(e) => set({ financiar: e.target.checked })} className="w-4 h-4 accent-brand-600" />
          <span className="text-sm font-medium text-slate-700">Mostrar financiación</span>
        </label>
        {form.financiar && (
          <div className="grid grid-cols-3 gap-3 pl-6">
            <Input label="Entrega ($)" type="number" value={form.entrega || ''} onChange={(e) => set({ entrega: +e.target.value })} />
            <Input label="Cant. cuotas" type="number" value={form.cuotas || ''} onChange={(e) => set({ cuotas: +e.target.value })} />
            <Input label="Valor cuota ($)" type="number" value={form.valorCuota || ''} onChange={(e) => set({ valorCuota: +e.target.value })} placeholder={cuotaSugerida ? String(Math.round(cuotaSugerida)) : 'auto'} />
            {cuotaSugerida > 0 && form.valorCuota === 0 && (
              <p className="col-span-3 text-[11px] text-slate-400">Sugerida: {formatCurrency(cuotaSugerida)} por cuota (precio − entrega ÷ cuotas). Podés escribir otro valor.</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Validez (días)" type="number" value={form.validezDias || ''} onChange={(e) => set({ validezDias: +e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones</label>
          <textarea
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
            rows={2}
            value={form.observaciones}
            onChange={(e) => set({ observaciones: e.target.value })}
          />
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Datos de contacto <span className="font-normal text-slate-400">(aparecen en el pie del PDF · se guardan para la próxima)</span></h3>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Teléfono / WhatsApp" value={contact.phone} onChange={(e) => saveContact({ phone: e.target.value })} placeholder="3400-000000" />
          <Input label="Instagram" value={contact.instagram} onChange={(e) => saveContact({ instagram: e.target.value })} placeholder="@majaautomotores" />
          <Input label="Dirección" value={contact.address} onChange={(e) => saveContact({ address: e.target.value })} placeholder="Ciudad" />
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
