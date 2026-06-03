import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, CheckSquare, Square, DollarSign, Wrench, Edit2, ImagePlus, X, UserPlus, HandCoins } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Textarea } from '../components/ui/Input';
import {
  formatCurrency, formatDate, formatKm,
  statusLabel, statusColor, supplierTypeLabel,
} from '../utils/formatters';
import { uploadVehicleImage } from '../utils/upload';
import type { VehicleStatus, PaymentMethod } from '../types';

const SENA_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'credito_prendario', label: 'Crédito prendario' },
];

const STATUS_FLOW: VehicleStatus[] = ['comprado', 'preparacion', 'publicado', 'vendido'];

const EXPENSE_CATEGORIES = [
  { value: 'mecanica', label: 'Mecánica' },
  { value: 'lavado', label: 'Lavado / Detailing' },
  { value: 'repuestos', label: 'Repuestos' },
  { value: 'gestion', label: 'Gestión / Papeles' },
  { value: 'pintura', label: 'Pintura / Chapa' },
  { value: 'otro', label: 'Otro' },
];

const BRAND_OPTIONS = ['Chevrolet', 'Citroën', 'Fiat', 'Ford', 'Honda', 'Hyundai',
  'Kia', 'Nissan', 'Peugeot', 'Renault', 'Suzuki', 'Toyota', 'Volkswagen', 'Otro']
  .map((b) => ({ value: b, label: b }));

const STATUS_OPTIONS = [
  { value: 'comprado',    label: 'Comprado' },
  { value: 'preparacion', label: 'En Preparación' },
  { value: 'publicado',   label: 'Publicado' },
];

const INITIAL_EXPENSE = { description: '', amount: 0, date: new Date().toISOString().split('T')[0], category: 'mecanica', supplierId: '', paid: false, notes: '' };

export function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vehicles, expenses, suppliers, clients, updateVehicle, deleteVehicle, addExpense, deleteExpense, markExpensePaid, addTransaction } = useStore();

  const vehicle = vehicles.find((v) => v.id === id);
  const vExpenses = expenses.filter((e) => e.vehicleId === id);
  const buyer = vehicle?.soldToClientId ? clients.find((c) => c.id === vehicle.soldToClientId) : null;

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignBuyerModal, setShowAssignBuyerModal] = useState(false);
  const [showSenaModal, setShowSenaModal] = useState(false);
  const [showCancelSenaModal, setShowCancelSenaModal] = useState(false);
  const [assignBuyerId, setAssignBuyerId] = useState('');
  const [expenseForm, setExpenseForm] = useState(INITIAL_EXPENSE);
  const [sellForm, setSellForm] = useState({ soldPrice: 0, soldDate: new Date().toISOString().split('T')[0], clientId: '' });
  const [senaForm, setSenaForm] = useState({
    type: 'venta' as 'venta' | 'compra', amount: 0,
    date: new Date().toISOString().split('T')[0], clientId: '', method: 'efectivo' as PaymentMethod,
  });
  const [editForm, setEditForm] = useState({
    brand: '', model: '', year: 0, km: 0,
    color: '', patent: '', purchasePrice: 0, publishPrice: 0,
    purchaseDate: '', notes: '', status: 'comprado' as VehicleStatus,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!vehicle) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Vehículo no encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/vehiculos')} className="mt-4">
          <ArrowLeft size={16} /> Volver
        </Button>
      </div>
    );
  }

  const totalCost = vExpenses.reduce((a, e) => a + e.amount, 0);
  const totalInvested = vehicle.purchasePrice + totalCost;
  const profitEstimated = (vehicle.soldPrice ?? vehicle.publishPrice) - totalInvested;
  const profitActual = vehicle.status === 'vendido' && vehicle.soldPrice
    ? vehicle.soldPrice - totalInvested : null;

  const daysInStock = (() => {
    const start = new Date(vehicle.purchaseDate);
    const end = vehicle.soldDate ? new Date(vehicle.soldDate) : new Date();
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const toggleChecklist = (key: keyof typeof vehicle.checklist) => {
    updateVehicle(id!, { checklist: { ...vehicle.checklist, [key]: !vehicle.checklist[key] } });
  };

  const handleStatusChange = (newStatus: VehicleStatus) => {
    if (newStatus === 'vendido') { openSellModal(); return; }
    updateVehicle(id!, { status: newStatus });
  };

  const openSellModal = () => {
    setSellForm({
      soldPrice: vehicle.soldPrice ?? vehicle.publishPrice ?? 0,
      soldDate: new Date().toISOString().split('T')[0],
      clientId: vehicle.senaClientId ?? '',
    });
    setShowSellModal(true);
  };

  const handleSell = () => {
    updateVehicle(id!, {
      status: 'vendido',
      soldPrice: sellForm.soldPrice,
      soldDate: sellForm.soldDate,
      ...(sellForm.clientId ? { soldToClientId: sellForm.clientId } : {}),
    });
    setShowSellModal(false);
  };

  const openSenaModal = () => {
    setSenaForm({ type: 'venta', amount: 0, date: new Date().toISOString().split('T')[0], clientId: '', method: 'efectivo' });
    setShowSenaModal(true);
  };

  const handleSenar = () => {
    if (!senaForm.amount) return;
    updateVehicle(id!, {
      status: 'señado',
      senaType: senaForm.type,
      senaAmount: senaForm.amount,
      senaDate: senaForm.date,
      senaClientId: senaForm.type === 'venta' ? (senaForm.clientId || undefined) : undefined,
      senaMethod: senaForm.method,
    });
    setShowSenaModal(false);
  };

  const handleCompleteCompra = () => {
    updateVehicle(id!, { status: 'comprado' });
  };

  // Resolver una seña que se cae. createTx: 'ingreso' = nos quedamos la plata,
  // 'egreso' = la perdimos, null = la plata vuelve a su dueño (no hay impacto neto).
  const handleResolveSena = (createTx: 'ingreso' | 'egreso' | null, label: string) => {
    const monto = vehicle.senaAmount ?? 0;
    if (createTx && monto > 0) {
      addTransaction({
        type: createTx,
        category: createTx === 'ingreso' ? 'otro_ingreso' : 'otro_egreso',
        amount: monto,
        description: `${label} — ${vehicle.brand} ${vehicle.model}`,
        date: new Date().toISOString().split('T')[0],
        paid: true,
        vehicleId: id!,
      });
    }
    updateVehicle(id!, { status: 'publicado', senaAmount: 0 });
    setShowCancelSenaModal(false);
  };

  const handleAssignBuyer = () => {
    if (!assignBuyerId) return;
    updateVehicle(id!, { soldToClientId: assignBuyerId });
    setShowAssignBuyerModal(false);
    setAssignBuyerId('');
  };

  const handleAddExpense = () => {
    if (!expenseForm.description || !expenseForm.amount) return;
    addExpense({ ...expenseForm, vehicleId: id!, supplierId: expenseForm.supplierId || undefined });
    setExpenseForm(INITIAL_EXPENSE);
    setShowExpenseModal(false);
  };

  const handleDelete = () => {
    if (confirm(`¿Eliminar ${vehicle.brand} ${vehicle.model}? Esta acción no se puede deshacer.`)) {
      deleteVehicle(id!);
      navigate('/vehiculos');
    }
  };

  const openEditModal = () => {
    setEditForm({
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      km: vehicle.km,
      color: vehicle.color,
      patent: vehicle.patent,
      purchasePrice: vehicle.purchasePrice,
      publishPrice: vehicle.publishPrice,
      purchaseDate: vehicle.purchaseDate,
      notes: vehicle.notes,
      status: vehicle.status === 'vendido' ? 'publicado' : vehicle.status,
    });
    setShowEditModal(true);
  };

  const handleEditSave = () => {
    updateVehicle(id!, editForm);
    setShowEditModal(false);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadingImage(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const url = await uploadVehicleImage(file);
        urls.push(url);
      }
      updateVehicle(id!, { images: [...(vehicle.images ?? []), ...urls] });
    } catch {
      alert('Error al subir la imagen. Intente de nuevo.');
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const updated = (vehicle.images ?? []).filter((_, i) => i !== index);
    updateVehicle(id!, { images: updated });
  };

  const checklistItems: [keyof typeof vehicle.checklist, string][] = [
    ['lavado', 'Lavado / Detailing'],
    ['pulido', 'Pulido / Encerado'],
    ['mecanica', 'Mecánica'],
    ['papeles', 'Papeles / Gestión'],
  ];

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/vehiculos')} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{vehicle.brand} {vehicle.model} {vehicle.year}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-slate-500 font-mono text-sm">{vehicle.patent}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 text-sm">{formatKm(vehicle.km)}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-500 text-sm">{vehicle.color}</span>
              <span className={`ml-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${statusColor[vehicle.status]}`}>
                {statusLabel[vehicle.status]}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEditModal}>
            <Edit2 size={14} /> Editar
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Status pipeline */}
      <Card>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Estado del vehículo</p>
        <div className="flex items-center gap-2">
          {STATUS_FLOW.map((s, i) => {
            const isActive = vehicle.status === s;
            const isPast = STATUS_FLOW.indexOf(vehicle.status) > i;
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => handleStatusChange(s)}
                  disabled={vehicle.status === 'vendido' || vehicle.status === 'señado'}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium text-center transition-colors ${
                    isActive ? 'bg-brand-600 text-white shadow-sm' :
                    isPast ? 'bg-green-100 text-green-700' :
                    'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  } disabled:cursor-default`}
                >
                  {statusLabel[s]}
                </button>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`w-6 h-0.5 flex-shrink-0 ${isPast ? 'bg-green-400' : 'bg-slate-200'}`} />
                )}
              </div>
            );
          })}
        </div>
        {vehicle.status === 'vendido' && (
          <div className="mt-2">
            {buyer ? (
              <p className="text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                Vendido a <button onClick={() => navigate(`/clientes/${buyer.id}`)} className="font-semibold underline">{buyer.firstName} {buyer.lastName}</button>
                {vehicle.soldDate ? ` el ${formatDate(vehicle.soldDate)}` : ''}
              </p>
            ) : (
              <button
                onClick={() => setShowAssignBuyerModal(true)}
                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
              >
                <UserPlus size={13} /> Asignar comprador
              </button>
            )}
          </div>
        )}

        {/* Botón Señar (cuando está en stock) */}
        {vehicle.status !== 'vendido' && vehicle.status !== 'señado' && (
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={openSenaModal}>
              <HandCoins size={14} /> Señar este vehículo
            </Button>
          </div>
        )}

        {/* Banner de seña activa */}
        {vehicle.status === 'señado' && (
          <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <HandCoins size={18} className="text-purple-600" />
              <p className="text-sm font-semibold text-purple-900">
                {vehicle.senaType === 'compra' ? 'Vehículo señado para comprar' : 'Vehículo señado por un comprador'}
              </p>
            </div>
            <p className="text-sm text-purple-800">
              Seña: <span className="font-bold">{formatCurrency(vehicle.senaAmount ?? 0)}</span>
              {vehicle.senaClientId && (() => {
                const c = clients.find((x) => x.id === vehicle.senaClientId);
                return c ? <span> · {c.firstName} {c.lastName}</span> : null;
              })()}
              {vehicle.senaDate ? ` · ${formatDate(vehicle.senaDate)}` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {vehicle.senaType === 'compra' ? (
                <Button size="sm" onClick={handleCompleteCompra}>
                  <CheckSquare size={14} /> Completar compra
                </Button>
              ) : (
                <Button size="sm" onClick={openSellModal}>
                  <DollarSign size={14} /> Registrar venta completa
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowCancelSenaModal(true)}>
                Se cayó la seña
              </Button>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="xl:col-span-1 sm:col-span-2 space-y-5">

          {/* Image gallery */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-semibold text-slate-900">Imágenes</p>
              <div>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUploadImage}
                />
                <Button size="sm" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>
                  <ImagePlus size={14} />
                  {uploadingImage ? 'Subiendo...' : 'Agregar imagen'}
                </Button>
              </div>
            </div>
            {(vehicle.images ?? []).length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {(vehicle.images ?? []).map((url, i) => (
                  <div key={i} className="relative group">
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`Imagen ${i + 1}`}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </a>
                    <button
                      onClick={() => handleRemoveImage(i)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">
                Sin imágenes. Agregá fotos del vehículo.
              </p>
            )}
          </Card>

          {/* Checklist */}
          <Card>
            <p className="text-base font-semibold text-slate-900 mb-4">Checklist de preparación</p>
            <div className="grid grid-cols-2 gap-3">
              {checklistItems.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleChecklist(key)}
                  disabled={vehicle.status === 'vendido'}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    vehicle.checklist[key]
                      ? 'bg-green-50 border-green-300 text-green-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  } disabled:cursor-default`}
                >
                  {vehicle.checklist[key]
                    ? <CheckSquare size={18} className="text-green-600 flex-shrink-0" />
                    : <Square size={18} className="text-slate-400 flex-shrink-0" />
                  }
                  <span className="text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(Object.values(vehicle.checklist).filter(Boolean).length / 4) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {Object.values(vehicle.checklist).filter(Boolean).length}/4 completado
            </p>
          </Card>

          {/* Expenses */}
          <Card padding={false}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <p className="text-base font-semibold text-slate-900">Gastos del vehículo</p>
              {vehicle.status !== 'vendido' && (
                <Button size="sm" onClick={() => setShowExpenseModal(true)}>
                  <Plus size={14} /> Agregar gasto
                </Button>
              )}
            </div>
            {vExpenses.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {vExpenses.map((e) => {
                  const sup = e.supplierId ? suppliers.find((s) => s.id === e.supplierId) : null;
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Wrench size={14} className="text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{e.description}</p>
                        <p className="text-xs text-slate-500">
                          {sup ? sup.name : 'Sin proveedor'} · {formatDate(e.date)}
                          {e.notes ? ` · ${e.notes}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(e.amount)}</span>
                        {e.paid
                          ? <Badge variant="success">Pagado</Badge>
                          : <button onClick={() => markExpensePaid(e.id)} className="text-xs text-brand-600 hover:underline">Marcar pagado</button>
                        }
                        <button onClick={() => deleteExpense(e.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="px-6 py-8 text-sm text-slate-400 text-center">Sin gastos registrados</p>
            )}
          </Card>

          {/* Notes */}
          {vehicle.notes && (
            <Card>
              <p className="text-sm font-semibold text-slate-700 mb-1">Notas</p>
              <p className="text-sm text-slate-600">{vehicle.notes}</p>
            </Card>
          )}
        </div>

        {/* Right column — Financials */}
        <div className="space-y-5">
          <Card>
            <p className="text-base font-semibold text-slate-900 mb-4">Rentabilidad</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Precio de compra</span>
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(vehicle.purchasePrice)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Gastos asociados</span>
                <span className="text-sm font-semibold text-red-600">+ {formatCurrency(totalCost)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-sm font-medium text-slate-700">Total invertido</span>
                <span className="text-sm font-bold text-slate-900">{formatCurrency(totalInvested)}</span>
              </div>
              {vehicle.status === 'vendido' ? (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Precio de venta</span>
                    <span className="text-sm font-semibold text-green-700">{formatCurrency(vehicle.soldPrice ?? 0)}</span>
                  </div>
                  <div className={`flex justify-between items-center py-3 px-4 rounded-xl ${profitActual! >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <span className="text-sm font-bold text-slate-900">Ganancia real</span>
                    <span className={`text-lg font-bold ${profitActual! >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {profitActual! >= 0 ? '+' : ''}{formatCurrency(profitActual!)}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-600">Precio publicado</span>
                    <span className="text-sm font-semibold text-brand-600">{formatCurrency(vehicle.publishPrice)}</span>
                  </div>
                  <div className={`flex justify-between items-center py-3 px-4 rounded-xl ${profitEstimated >= 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
                    <span className="text-sm font-bold text-slate-900">Margen estimado</span>
                    <span className={`text-lg font-bold ${profitEstimated >= 0 ? 'text-brand-600' : 'text-red-700'}`}>
                      {profitEstimated >= 0 ? '+' : ''}{formatCurrency(profitEstimated)}
                    </span>
                  </div>
                </>
              )}
            </div>
            {vehicle.status !== 'vendido' && (
              <Button className="w-full mt-4" onClick={openSellModal}>
                <DollarSign size={15} /> Registrar venta
              </Button>
            )}
          </Card>

          {/* Info */}
          <Card>
            <p className="text-base font-semibold text-slate-900 mb-3">Información</p>
            <dl className="space-y-2 text-sm">
              {[
                ['Comprado el', formatDate(vehicle.purchaseDate)],
                ['Año', vehicle.year],
                ['Kilometraje', formatKm(vehicle.km)],
                ['Color', vehicle.color],
                ['Patente', vehicle.patent],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex justify-between">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-900">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <dt className="text-slate-500">{vehicle.status === 'vendido' ? 'Días en stock' : 'Días en stock'}</dt>
                <dd className={`font-bold ${
                  vehicle.status === 'vendido' ? 'text-slate-500' :
                  daysInStock < 30 ? 'text-green-600' :
                  daysInStock < 60 ? 'text-amber-600' : 'text-red-600'
                }`}>
                  {daysInStock} días
                </dd>
              </div>
            </dl>
          </Card>

          {/* Documentación */}
          <Card>
            <p className="text-base font-semibold text-slate-900 mb-3">Documentación</p>
            <div className="space-y-2">
              {(Object.entries(vehicle.documents ?? {}) as [keyof typeof vehicle.documents, boolean][]).map(([key, checked]) => {
                const docLabels: Record<string, string> = {
                  titulo: 'Título del automotor',
                  cedulaVerde: 'Cédula verde',
                  cedulaAzul: 'Cédula azul',
                  vtv: 'VTV vigente',
                  libreDeuda: 'Libre de deuda (multas/patentes)',
                  verificacionPolicial: 'Verificación policial',
                  seguro: 'Seguro',
                };
                return (
                  <button
                    key={key}
                    onClick={() => updateVehicle(id!, { documents: { ...vehicle.documents, [key]: !checked } })}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left text-sm transition-all ${
                      checked
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {checked
                      ? <CheckSquare size={15} className="text-green-600 flex-shrink-0" />
                      : <Square size={15} className="text-slate-400 flex-shrink-0" />
                    }
                    {docLabels[key] ?? key}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 bg-slate-100 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{
                  width: `${(Object.values(vehicle.documents ?? {}).filter(Boolean).length / 7) * 100}%`,
                }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {Object.values(vehicle.documents ?? {}).filter(Boolean).length}/7 documentos
            </p>
          </Card>

          {/* Supplier debts */}
          {vExpenses.filter((e) => !e.paid && e.supplierId).length > 0 && (
            <Card>
              <p className="text-sm font-semibold text-amber-800 mb-2">Deuda a proveedores</p>
              {vExpenses.filter((e) => !e.paid && e.supplierId).map((e) => {
                const sup = suppliers.find((s) => s.id === e.supplierId);
                return (
                  <div key={e.id} className="flex justify-between text-sm py-1">
                    <span className="text-slate-600">{sup?.name ?? 'Proveedor'}</span>
                    <span className="font-semibold text-amber-700">{formatCurrency(e.amount)}</span>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>

      {/* Add expense modal */}
      <Modal
        isOpen={showExpenseModal}
        onClose={() => { setShowExpenseModal(false); setExpenseForm(INITIAL_EXPENSE); }}
        title="Agregar gasto"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowExpenseModal(false); setExpenseForm(INITIAL_EXPENSE); }}>Cancelar</Button>
            <Button onClick={handleAddExpense}>Guardar gasto</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Descripción" value={expenseForm.description}
            onChange={(e) => setExpenseForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ej: Cambio de pastillas de freno"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Monto ($)" type="number" value={expenseForm.amount}
              onChange={(e) => setExpenseForm((f) => ({ ...f, amount: +e.target.value }))}
            />
            <Input
              label="Fecha" type="date" value={expenseForm.date}
              onChange={(e) => setExpenseForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <Select
            label="Categoría" value={expenseForm.category}
            onChange={(e) => setExpenseForm((f) => ({ ...f, category: e.target.value }))}
            options={EXPENSE_CATEGORIES}
          />
          <Select
            label="Proveedor (opcional)" value={expenseForm.supplierId}
            onChange={(e) => setExpenseForm((f) => ({ ...f, supplierId: e.target.value }))}
            options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${supplierTypeLabel[s.type]})` }))}
            placeholder="Sin proveedor"
          />
          <Textarea
            label="Notas" value={expenseForm.notes}
            onChange={(e) => setExpenseForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Observaciones adicionales..."
          />
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={expenseForm.paid} onChange={(e) => setExpenseForm((f) => ({ ...f, paid: e.target.checked }))} className="rounded" />
            Ya pagado
          </label>
        </div>
      </Modal>

      {/* Sell modal */}
      <Modal
        isOpen={showSellModal}
        onClose={() => setShowSellModal(false)}
        title="Registrar venta"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowSellModal(false)}>Cancelar</Button>
            <Button onClick={handleSell}>Confirmar venta</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 rounded-xl text-sm">
            <p className="text-slate-600">Vehículo: <span className="font-semibold text-slate-900">{vehicle.brand} {vehicle.model} {vehicle.year}</span></p>
            <p className="text-slate-600 mt-1">Precio publicado: <span className="font-semibold">{formatCurrency(vehicle.publishPrice)}</span></p>
            {vehicle.status === 'señado' && (vehicle.senaAmount ?? 0) > 0 && (
              <p className="text-purple-700 mt-1">Seña ya recibida: <span className="font-semibold">{formatCurrency(vehicle.senaAmount ?? 0)}</span> (parte del pago)</p>
            )}
          </div>
          <Input
            label="Precio de venta ($)" type="number" value={sellForm.soldPrice}
            onChange={(e) => setSellForm((f) => ({ ...f, soldPrice: +e.target.value }))}
          />
          <Input
            label="Fecha de venta" type="date" value={sellForm.soldDate}
            onChange={(e) => setSellForm((f) => ({ ...f, soldDate: e.target.value }))}
          />
          <Select
            label="Comprador (opcional)"
            value={sellForm.clientId}
            onChange={(e) => setSellForm((f) => ({ ...f, clientId: e.target.value }))}
            options={clients.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} — DNI ${c.dni}` }))}
            placeholder="Sin comprador asignado"
          />
          {sellForm.soldPrice > 0 && (
            <div className={`p-3 rounded-xl text-sm font-medium ${sellForm.soldPrice - totalInvested >= 0 ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              Ganancia: {formatCurrency(sellForm.soldPrice - totalInvested)}
            </div>
          )}
        </div>
      </Modal>

      {/* Señar modal */}
      <Modal
        isOpen={showSenaModal}
        onClose={() => setShowSenaModal(false)}
        title="Señar vehículo"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowSenaModal(false)}>Cancelar</Button>
            <Button onClick={handleSenar}>Guardar seña</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {([['venta', 'Me lo señaron'], ['compra', 'Yo lo señé']] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setSenaForm((f) => ({ ...f, type: t }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border-2 ${
                  senaForm.type === t
                    ? t === 'venta' ? 'bg-green-50 border-green-400 text-green-800' : 'bg-red-50 border-red-400 text-red-800'
                    : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {senaForm.type === 'venta'
              ? 'Un comprador te dejó una seña para reservar este vehículo. Cuando se concrete, registrás la venta completa.'
              : 'Vos dejaste una seña para comprar este vehículo. Cuando termines de pagarlo, lo completás y entra a tu stock.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Monto de la seña ($)" type="number" value={senaForm.amount}
              onChange={(e) => setSenaForm((f) => ({ ...f, amount: +e.target.value }))} />
            <Input label="Fecha" type="date" value={senaForm.date}
              onChange={(e) => setSenaForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <Select label="Medio de pago" value={senaForm.method}
            onChange={(e) => setSenaForm((f) => ({ ...f, method: e.target.value as PaymentMethod }))}
            options={SENA_METHODS} />
          {senaForm.type === 'venta' && (
            <Select label="Comprador (opcional)" value={senaForm.clientId}
              onChange={(e) => setSenaForm((f) => ({ ...f, clientId: e.target.value }))}
              options={clients.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} — DNI ${c.dni}` }))}
              placeholder="Sin comprador asignado" />
          )}
        </div>
      </Modal>

      {/* Se cayó la seña modal */}
      <Modal
        isOpen={showCancelSenaModal}
        onClose={() => setShowCancelSenaModal(false)}
        title="Se cayó la seña"
        footer={<Button variant="outline" onClick={() => setShowCancelSenaModal(false)}>Cerrar</Button>}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            La operación no se concretó. ¿Qué pasó con la seña de <span className="font-semibold">{formatCurrency(vehicle.senaAmount ?? 0)}</span>?
          </p>
          {vehicle.senaType === 'compra' ? (
            <>
              <button
                onClick={() => handleResolveSena(null, 'Seña recuperada')}
                className="w-full text-left p-3 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 transition-colors"
              >
                <p className="text-sm font-semibold text-green-800">Se cayó por el vendedor</p>
                <p className="text-xs text-green-700">Te devuelven la seña — la plata vuelve a vos.</p>
              </button>
              <button
                onClick={() => handleResolveSena('egreso', 'Seña perdida')}
                className="w-full text-left p-3 rounded-xl border-2 border-red-200 bg-red-50 hover:border-red-400 transition-colors"
              >
                <p className="text-sm font-semibold text-red-800">Se cayó por vos</p>
                <p className="text-xs text-red-700">Perdés la seña — queda registrada como egreso.</p>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => handleResolveSena('ingreso', 'Seña retenida')}
                className="w-full text-left p-3 rounded-xl border-2 border-green-200 bg-green-50 hover:border-green-400 transition-colors"
              >
                <p className="text-sm font-semibold text-green-800">Se cayó por el cliente</p>
                <p className="text-xs text-green-700">Te quedás con la seña — entra como ingreso.</p>
              </button>
              <button
                onClick={() => handleResolveSena(null, 'Seña devuelta')}
                className="w-full text-left p-3 rounded-xl border-2 border-slate-200 bg-slate-50 hover:border-slate-400 transition-colors"
              >
                <p className="text-sm font-semibold text-slate-800">Se cayó por vos</p>
                <p className="text-xs text-slate-600">Le devolvés la plata al cliente — no queda nada.</p>
              </button>
            </>
          )}
          <p className="text-[11px] text-slate-400">El vehículo vuelve a estado "Publicado".</p>
        </div>
      </Modal>

      {/* Assign buyer modal */}
      <Modal
        isOpen={showAssignBuyerModal}
        onClose={() => { setShowAssignBuyerModal(false); setAssignBuyerId(''); }}
        title="Asignar comprador"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowAssignBuyerModal(false); setAssignBuyerId(''); }}>Cancelar</Button>
            <Button onClick={handleAssignBuyer} disabled={!assignBuyerId}>Asignar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Seleccioná el cliente que compró este vehículo.
          </p>
          <Select
            label="Cliente"
            value={assignBuyerId}
            onChange={(e) => setAssignBuyerId(e.target.value)}
            options={clients.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName} — DNI ${c.dni}` }))}
            placeholder="Seleccionar cliente"
          />
        </div>
      </Modal>

      {/* Edit vehicle modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar vehículo"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleEditSave}>Guardar cambios</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Marca" value={editForm.brand}
            onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
            options={BRAND_OPTIONS}
          />
          <Input
            label="Modelo" value={editForm.model}
            onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
          />
          <Input
            label="Año" type="number" value={editForm.year}
            onChange={(e) => setEditForm((f) => ({ ...f, year: +e.target.value }))}
          />
          <Input
            label="Kilometraje" type="number" value={editForm.km}
            onChange={(e) => setEditForm((f) => ({ ...f, km: +e.target.value }))}
          />
          <Input
            label="Color" value={editForm.color}
            onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
          />
          <Input
            label="Patente" value={editForm.patent}
            onChange={(e) => setEditForm((f) => ({ ...f, patent: e.target.value }))}
          />
          <Input
            label="Precio de compra ($)" type="number" value={editForm.purchasePrice}
            onChange={(e) => setEditForm((f) => ({ ...f, purchasePrice: +e.target.value }))}
          />
          <Input
            label="Precio de publicación ($)" type="number" value={editForm.publishPrice}
            onChange={(e) => setEditForm((f) => ({ ...f, publishPrice: +e.target.value }))}
          />
          <Input
            label="Fecha de compra" type="date" value={editForm.purchaseDate}
            onChange={(e) => setEditForm((f) => ({ ...f, purchaseDate: e.target.value }))}
          />
          {vehicle.status !== 'vendido' && (
            <Select
              label="Estado"
              value={editForm.status}
              onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as VehicleStatus }))}
              options={STATUS_OPTIONS}
            />
          )}
          <div className="col-span-1 sm:col-span-2">
            <Textarea
              label="Notas" value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Observaciones del vehículo..."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
