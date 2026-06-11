import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Car, ChevronRight, X, ImagePlus } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Card } from '../components/ui/Card';
import { Textarea } from '../components/ui/Input';
import {
  formatCurrency, formatKm, formatDate,
  statusLabel, statusColor, vehicleLabel, supplierTypeLabel,
} from '../utils/formatters';
import { uploadVehicleImage } from '../utils/upload';
import { notify } from '../components/ui/Feedback';
import type { VehicleStatus } from '../types';

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'comprado',    label: 'Comprado' },
  { value: 'preparacion', label: 'En Preparación' },
  { value: 'publicado',   label: 'Publicado' },
  { value: 'señado',      label: 'Señado' },
  { value: 'vendido',     label: 'Vendido' },
];

const BRAND_OPTIONS = ['Chevrolet', 'Citroën', 'Fiat', 'Ford', 'Honda', 'Hyundai',
  'Kia', 'Nissan', 'Peugeot', 'Renault', 'Suzuki', 'Toyota', 'Volkswagen', 'Otro']
  .map((b) => ({ value: b, label: b }));

const INITIAL_FORM = {
  brand: '', model: '', year: new Date().getFullYear(), km: 0,
  color: '', patent: '', status: 'comprado' as VehicleStatus,
  purchasePrice: 0, publishPrice: 0, purchaseDate: new Date().toISOString().split('T')[0],
  notes: '', purchaseSupplierId: '',
};

export function Vehicles() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { vehicles, expenses, addVehicle, suppliers } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [brandFilter, setBrandFilter] = useState('');
  const [kmMin, setKmMin] = useState('');
  const [kmMax, setKmMax] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [formError, setFormError] = useState('');
  const [pendingImages, setPendingImages] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unique brands from actual vehicles list
  const uniqueBrands = Array.from(new Set(vehicles.map((v) => v.brand))).sort();
  const brandFilterOptions = [
    { value: '', label: 'Todas las marcas' },
    ...uniqueBrands.map((b) => ({ value: b, label: b })),
  ];

  const filtered = vehicles.filter((v) => {
    const matchSearch = search === '' ||
      `${v.brand} ${v.model} ${v.year} ${v.patent}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === '' || v.status === statusFilter;
    const matchBrand = brandFilter === '' || v.brand === brandFilter;
    const matchKmMin = kmMin === '' || v.km >= Number(kmMin);
    const matchKmMax = kmMax === '' || v.km <= Number(kmMax);
    return matchSearch && matchStatus && matchBrand && matchKmMin && matchKmMax;
  });

  const vehicleCost = (id: string) =>
    expenses.filter((e) => e.vehicleId === id).reduce((a, e) => a + e.amount, 0);

  const daysInStock = (v: typeof vehicles[0]) => {
    const start = new Date(v.purchaseDate);
    const end = v.soldDate ? new Date(v.soldDate) : new Date();
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  };

  const stockColor = (days: number, sold: boolean) => {
    if (sold) return 'text-slate-400';
    if (days < 30) return 'text-green-600';
    if (days < 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const newPreviews = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingImages((prev) => [...prev, ...newPreviews]);
    // Reset input so same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setPendingImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSave = async () => {
    if (!form.brand) { setFormError('Seleccioná una marca.'); return; }
    if (!form.model.trim()) { setFormError('El modelo es obligatorio.'); return; }
    if (!form.patent.trim()) { setFormError('La patente es obligatoria.'); return; }
    setFormError('');
    setUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const { file } of pendingImages) {
        const url = await uploadVehicleImage(file);
        uploadedUrls.push(url);
      }
      addVehicle({
        ...form,
        images: uploadedUrls,
        checklist: { lavado: false, pulido: false, mecanica: false, papeles: false },
        documents: { titulo: false, cedulaVerde: false, cedulaAzul: false, vtv: false, libreDeuda: false, verificacionPolicial: false, seguro: false },
      });
      setShowModal(false);
      setForm(INITIAL_FORM);
      pendingImages.forEach((img) => URL.revokeObjectURL(img.preview));
      setPendingImages([]);
    } catch {
      notify('Error al subir las imágenes. Intentá de nuevo.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setForm(INITIAL_FORM);
    setFormError('');
    pendingImages.forEach((img) => URL.revokeObjectURL(img.preview));
    setPendingImages([]);
  };

  const field = (key: keyof typeof INITIAL_FORM, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Vehículos</h1>
          <p className="text-slate-500 text-sm mt-0.5">{vehicles.length} vehículos registrados</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> <span className="hidden sm:inline">Nuevo vehículo</span><span className="sm:hidden">Nuevo</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, patente..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
          />
        </div>
        <select
          value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600 text-slate-700"
        >
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600 text-slate-700"
        >
          {brandFilterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="KM mín"
            value={kmMin}
            onChange={(e) => setKmMin(e.target.value)}
            className="w-24 px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
          />
          <span className="text-slate-400 text-sm">—</span>
          <input
            type="number"
            placeholder="KM máx"
            value={kmMax}
            onChange={(e) => setKmMax(e.target.value)}
            className="w-24 px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
          />
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {(['comprado', 'preparacion', 'publicado', 'señado', 'vendido'] as VehicleStatus[]).map((s) => {
          const count = vehicles.filter((v) => v.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? statusColor[s] + ' ring-2 ring-offset-1 ring-current' : statusColor[s]
              }`}
            >
              {statusLabel[s]} ({count})
            </button>
          );
        })}
      </div>

      {/* Table */}
      <Card padding={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Vehículo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Patente</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Compra</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Gastos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Precio</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Días</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 hidden sm:table-cell"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => {
                const cost = vehicleCost(v.id);
                const margin = v.status === 'vendido' && v.soldPrice
                  ? v.soldPrice - v.purchasePrice - cost
                  : v.publishPrice - v.purchasePrice - cost;
                return (
                  <tr
                    key={v.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/vehiculos/${v.id}`)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {v.images?.length > 0 ? (
                          <img
                            src={v.images[0]}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Car size={16} className="text-slate-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-900">{vehicleLabel(v.brand, v.model, v.year)}</p>
                          <p className="text-xs text-slate-500">{formatKm(v.km)} · {v.color}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 font-mono text-sm hidden md:table-cell">{v.patent}</td>
                    <td className="px-4 py-4 text-right text-slate-700 hidden lg:table-cell">{formatCurrency(v.purchasePrice)}</td>
                    <td className="px-4 py-4 text-right text-slate-700 hidden lg:table-cell">{cost > 0 ? formatCurrency(cost) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-4 text-right hidden sm:table-cell">
                      {v.status === 'vendido'
                        ? <span className="text-green-700 font-medium">{formatCurrency(v.soldPrice ?? 0)}</span>
                        : <span className="text-slate-700">{formatCurrency(v.publishPrice)}</span>
                      }
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-xs font-bold tabular-nums ${stockColor(daysInStock(v), v.status === 'vendido')}`}>
                        {daysInStock(v)}d
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor[v.status]}`}>
                        {statusLabel[v.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right hidden sm:table-cell">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`text-xs font-semibold ${margin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {margin >= 0 ? '+' : ''}{formatCurrency(margin)}
                        </span>
                        <ChevronRight size={16} className="text-slate-400" />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    No se encontraron vehículos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title="Nuevo vehículo"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={handleCloseModal}>Cancelar</Button>
            <Button onClick={handleSave} disabled={uploading}>
              {uploading ? 'Guardando...' : 'Guardar vehículo'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {formError && <p className="col-span-1 sm:col-span-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>}
          <Select
            label="Marca" value={form.brand}
            onChange={(e) => field('brand', e.target.value)}
            options={BRAND_OPTIONS} placeholder="Seleccionar marca"
          />
          <Input label="Modelo" value={form.model} onChange={(e) => field('model', e.target.value)} placeholder="Ej: Ranger XLT" />
          <Input label="Año" type="number" value={form.year} onChange={(e) => field('year', +e.target.value)} />
          <Input label="Kilometraje" type="number" value={form.km} onChange={(e) => field('km', +e.target.value)} />
          <Input label="Color" value={form.color} onChange={(e) => field('color', e.target.value)} placeholder="Ej: Blanco" />
          <Input label="Patente" value={form.patent} onChange={(e) => field('patent', e.target.value)} placeholder="AB 123 CD" />
          <Input label="Precio de compra ($)" type="number" value={form.purchasePrice} onChange={(e) => field('purchasePrice', +e.target.value)} />
          <Input label="Precio de publicación ($)" type="number" value={form.publishPrice} onChange={(e) => field('publishPrice', +e.target.value)} />
          <Input label="Fecha de compra" type="date" value={form.purchaseDate} onChange={(e) => field('purchaseDate', e.target.value)} />
          <Select
            label="Estado inicial" value={form.status}
            onChange={(e) => field('status', e.target.value as VehicleStatus)}
            options={STATUS_OPTIONS.filter((o) => o.value !== '')}
          />
          <div className="col-span-1 sm:col-span-2">
            <Select
              label="Comprado a (agencia / proveedor) — opcional"
              value={form.purchaseSupplierId}
              onChange={(e) => field('purchaseSupplierId', e.target.value)}
              options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${supplierTypeLabel[s.type]})` }))}
              placeholder="Sin especificar"
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <Textarea label="Notas" value={form.notes} onChange={(e) => field('notes', e.target.value)} placeholder="Observaciones del vehículo..." />
          </div>

          {/* Image upload area */}
          <div className="col-span-1 sm:col-span-2">
            <p className="text-sm font-medium text-slate-700 mb-2">Imágenes</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors w-full justify-center"
            >
              <ImagePlus size={16} />
              Seleccionar imágenes
            </button>
            {pendingImages.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {pendingImages.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img.preview}
                      alt=""
                      className="w-full h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
