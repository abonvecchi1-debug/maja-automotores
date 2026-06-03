import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, AlertTriangle, CheckCircle, Plus, Edit2, Trash2, Cake, Link2, X } from 'lucide-react';
import { useStore } from '../store';
import type { SalePayment, Cheque } from '../types';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Textarea } from '../components/ui/Input';
import { formatCurrency, formatDate, vehicleLabel } from '../utils/formatters';

/** Borrador de cheque cargado dentro de una venta (se registra luego en el módulo Cheques). */
type ChequeDraft = {
  numero: string; banco: string; monto: number; moneda: 'ARS' | 'USD';
  fechaVencimiento: string; tipo: 'al_dia' | 'diferido'; librador: string;
};
const emptyChequeDraft = (): ChequeDraft => ({
  numero: '', banco: '', monto: 0, moneda: 'ARS', fechaVencimiento: '', tipo: 'diferido', librador: '',
});

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, sales, installmentPayments, vehicles, senas, addSale, markInstallmentPaid, updateClient, deleteClient, updateVehicle, updateSena } = useStore();

  const client = clients.find((c) => c.id === id);
  const clientSales = sales.filter((s) => s.clientId === id);
  const clientPayments = installmentPayments.filter((p) =>
    clientSales.some((s) => s.id === p.saleId)
  );
  // Vehículos vinculados directamente (sin venta formal registrada)
  const linkedVehicles = vehicles.filter(
    (v) => v.soldToClientId === id && !clientSales.some((s) => s.vehicleId === v.id)
  );

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLinkVehicleModal, setShowLinkVehicleModal] = useState(false);
  const [linkVehicleId, setLinkVehicleId] = useState('');
  const [saleForm, setSaleForm] = useState({
    vehicleId: '', saleDate: new Date().toISOString().split('T')[0],
    salePrice: 0, paymentType: 'contado' as 'contado' | 'financiado',
    downPayment: 0, installments: 12, notes: '',
    invoiceNumber: '', tradeInVehicleId: '', tradeInValue: 0,
    payEfectivo: 0, payTransferencia: 0, payPrendario: 0, prendarioRef: '',
    senaAplicada: 0, cheques: [] as ChequeDraft[],
  });
  const resetSaleForm = () => setSaleForm({
    vehicleId: '', saleDate: new Date().toISOString().split('T')[0], salePrice: 0, paymentType: 'contado',
    downPayment: 0, installments: 12, notes: '', invoiceNumber: '', tradeInVehicleId: '', tradeInValue: 0,
    payEfectivo: 0, payTransferencia: 0, payPrendario: 0, prendarioRef: '', senaAplicada: 0, cheques: [],
  });
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', dni: '', cuit: '', phone: '', phone2: '',
    email: '', address: '', city: '', province: '', notes: '', birthDate: '',
  });

  if (!client) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Cliente no encontrado.</p>
        <Button variant="ghost" onClick={() => navigate('/clientes')} className="mt-4">
          <ArrowLeft size={16} /> Volver
        </Button>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const todayMMDD = today.slice(5);
  const isBirthdayToday = !!client?.birthDate && client.birthDate.slice(5) === todayMMDD;

  const soldVehiclesWithoutBuyer = vehicles.filter(
    (v) => v.status === 'vendido' && !v.soldToClientId
  );

  const totalPaid = clientPayments.filter((p) => p.paid).reduce((a, p) => a + p.amount, 0);
  const totalPending = clientPayments.filter((p) => !p.paid).reduce((a, p) => a + p.amount, 0);
  const overduePayments = clientPayments.filter((p) => !p.paid && p.dueDate < today);

  const availableVehicles = vehicles.filter((v) => v.status === 'publicado');

  const openEditModal = () => {
    setEditForm({
      firstName: client.firstName,
      lastName: client.lastName,
      dni: client.dni,
      cuit: client.cuit ?? '',
      phone: client.phone,
      phone2: client.phone2 ?? '',
      email: client.email,
      address: client.address,
      city: client.city,
      province: client.province,
      notes: client.notes,
      birthDate: client.birthDate ?? '',
    });
    setShowEditModal(true);
  };

  const handleEditSave = () => {
    updateClient(id!, {
      ...editForm,
      cuit: editForm.cuit || undefined,
      phone2: editForm.phone2 || undefined,
      birthDate: editForm.birthDate || undefined,
    });
    setShowEditModal(false);
  };

  const handleLinkVehicle = () => {
    if (!linkVehicleId) return;
    updateVehicle(linkVehicleId, { soldToClientId: id! });
    setShowLinkVehicleModal(false);
    setLinkVehicleId('');
  };

  const handleDelete = () => {
    deleteClient(id!);
    navigate('/clientes');
  };

  const handleAddSale = () => {
    if (!saleForm.vehicleId || !saleForm.salePrice) return;
    const installmentAmount = saleForm.paymentType === 'financiado' && saleForm.installments > 0
      ? (saleForm.salePrice - saleForm.downPayment) / saleForm.installments : 0;
    const payments = saleForm.paymentType === 'financiado'
      ? Array.from({ length: saleForm.installments }, (_, i) => {
          const due = new Date(saleForm.saleDate);
          due.setMonth(due.getMonth() + i + 1);
          return {
            saleId: '',
            installmentNumber: i + 1,
            dueDate: due.toISOString().split('T')[0],
            amount: installmentAmount,
            paid: false,
          };
        })
      : [];

    // Desglose de medios de pago
    const chequesTotal = saleForm.cheques.reduce((a, c) => a + (c.monto || 0), 0);
    const paymentMethods: SalePayment[] = [];
    if (saleForm.payEfectivo > 0) paymentMethods.push({ method: 'efectivo', amount: saleForm.payEfectivo });
    if (saleForm.payTransferencia > 0) paymentMethods.push({ method: 'transferencia', amount: saleForm.payTransferencia });
    if (saleForm.payPrendario > 0) paymentMethods.push({ method: 'credito_prendario', amount: saleForm.payPrendario, reference: saleForm.prendarioRef || undefined });
    if (chequesTotal > 0) paymentMethods.push({ method: 'cheque', amount: chequesTotal });
    if (saleForm.tradeInValue > 0) paymentMethods.push({ method: 'parte_pago', amount: saleForm.tradeInValue });
    if (saleForm.senaAplicada > 0) paymentMethods.push({ method: 'sena', amount: saleForm.senaAplicada });

    // Cheques recibidos → se crearán en el módulo Cheques (recibidoDe lo completa el server con el cliente)
    const chequeDrafts: Omit<Cheque, 'id' | 'createdAt'>[] = saleForm.cheques
      .filter((c) => c.numero || c.monto)
      .map((c) => ({
        numero: c.numero, serie: '', banco: c.banco, monto: c.monto, moneda: c.moneda,
        fechaEmision: '', fechaVencimiento: c.fechaVencimiento, tipo: c.tipo,
        alPortador: false, endosado: false, endosadoPor: '', dniEndosante: '',
        librador: c.librador, cuitLibrador: '', recibidoDe: '', entregadoA: '',
        estado: 'en_cartera', observaciones: 'Recibido por venta de vehículo',
      }));

    addSale(
      {
        vehicleId: saleForm.vehicleId, clientId: id!, saleDate: saleForm.saleDate,
        salePrice: saleForm.salePrice, paymentType: saleForm.paymentType,
        downPayment: saleForm.downPayment, installments: saleForm.installments,
        installmentAmount, notes: saleForm.notes,
        invoiceNumber: saleForm.invoiceNumber || undefined,
        tradeInVehicleId: saleForm.tradeInVehicleId || undefined,
        tradeInValue: saleForm.tradeInValue || undefined,
        paymentMethods: paymentMethods.length ? paymentMethods : undefined,
      },
      payments,
      chequeDrafts,
    );

    // Si se aplicó una seña, marcar las señas activas de este vehículo como aplicadas
    if (saleForm.senaAplicada > 0) {
      senas
        .filter((s) => s.type === 'venta' && s.status === 'activa' && s.vehicleId === saleForm.vehicleId)
        .forEach((s) => updateSena(s.id, { status: 'aplicada' }));
    }

    setShowSaleModal(false);
    resetSaleForm();
  };

  // Helpers de cheques-borrador dentro de la venta
  const addChequeDraft = () => setSaleForm((f) => ({ ...f, cheques: [...f.cheques, emptyChequeDraft()] }));
  const updateChequeDraft = (i: number, patch: Partial<ChequeDraft>) =>
    setSaleForm((f) => ({ ...f, cheques: f.cheques.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));
  const removeChequeDraft = (i: number) =>
    setSaleForm((f) => ({ ...f, cheques: f.cheques.filter((_, idx) => idx !== i) }));

  // Seña activa de venta para el vehículo seleccionado (para sugerir aplicarla)
  const activeSenaForVehicle = senas.find(
    (s) => s.type === 'venta' && s.status === 'activa' && s.vehicleId === saleForm.vehicleId
  );

  const chequesDraftTotal = saleForm.cheques.reduce((a, c) => a + (c.monto || 0), 0);
  const assignedTotal =
    saleForm.payEfectivo + saleForm.payTransferencia + saleForm.payPrendario +
    chequesDraftTotal + saleForm.tradeInValue + saleForm.senaAplicada;
  const assignedRemainder = saleForm.salePrice - assignedTotal;

  const groupedByMonth = clientPayments.reduce((acc, p) => {
    const sale = clientSales.find((s) => s.id === p.saleId);
    const veh = sale ? vehicles.find((v) => v.id === sale.vehicleId) : null;
    const key = veh ? `${veh.brand} ${veh.model} ${veh.year}` : p.saleId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {} as Record<string, typeof clientPayments>);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/clientes')} className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold text-lg">
              {client.firstName[0]}{client.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{client.firstName} {client.lastName}</h1>
                {isBirthdayToday && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    <Cake size={12} /> ¡Hoy cumple años!
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm">DNI: {client.dni} · Cliente desde {formatDate(client.createdAt)}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEditModal}>
            <Edit2 size={14} /> Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 size={14} /> Eliminar
          </Button>
          {soldVehiclesWithoutBuyer.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowLinkVehicleModal(true)}>
              <Link2 size={14} /> Vincular vehículo
            </Button>
          )}
          <Button onClick={() => setShowSaleModal(true)}>
            <Plus size={16} /> Registrar venta
          </Button>
        </div>
      </div>

      {/* Overdue alert */}
      {overduePayments.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            {overduePayments.length} cuota{overduePayments.length > 1 ? 's' : ''} vencida{overduePayments.length > 1 ? 's' : ''} · Total adeudado: {formatCurrency(overduePayments.reduce((a, p) => a + p.amount, 0))}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: installments */}
        <div className="xl:col-span-1 sm:col-span-2 space-y-5">

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-green-50">
              <p className="text-xs text-slate-500 font-medium">Total cobrado</p>
              <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(totalPaid)}</p>
            </Card>
            <Card className={totalPending > 0 ? 'bg-amber-50' : 'bg-slate-50'}>
              <p className="text-xs text-slate-500 font-medium">Saldo pendiente</p>
              <p className={`text-xl font-bold mt-1 ${totalPending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{formatCurrency(totalPending)}</p>
            </Card>
            <Card className="bg-blue-50">
              <p className="text-xs text-slate-500 font-medium">Compras totales</p>
              <p className="text-xl font-bold text-brand-600 mt-1">{clientSales.length + linkedVehicles.length}</p>
            </Card>
          </div>

          {/* Installment plans */}
          {Object.entries(groupedByMonth).map(([label, payments]) => {
            const sorted = [...payments].sort((a, b) => a.installmentNumber - b.installmentNumber);
            const paidCount = sorted.filter((p) => p.paid).length;
            return (
              <Card key={label} padding={false}>
                <div className="px-6 py-4 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Car size={16} className="text-slate-500" />
                      <p className="font-semibold text-slate-900">{label}</p>
                    </div>
                    <p className="text-sm text-slate-500">{paidCount}/{sorted.length} cuotas pagas</p>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-3 bg-slate-100 rounded-full h-1.5">
                    <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${(paidCount / sorted.length) * 100}%` }} />
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {sorted.map((p) => {
                    const isOverdue = !p.paid && p.dueDate < today;
                    return (
                      <div key={p.id} className={`flex items-center gap-4 px-6 py-3 ${isOverdue ? 'bg-red-50' : ''}`}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                          p.paid ? 'bg-green-100 text-green-700' : isOverdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {p.installmentNumber}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">Cuota {p.installmentNumber}</p>
                          <p className={`text-xs ${isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                            Vence: {formatDate(p.dueDate)}
                            {p.paid && p.paidDate ? ` · Pagado ${formatDate(p.paidDate)}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.amount)}</span>
                        {p.paid ? (
                          <CheckCircle size={18} className="text-green-500" />
                        ) : (
                          <Button size="sm" variant={isOverdue ? 'danger' : 'secondary'} onClick={() => markInstallmentPaid(p.id)}>
                            Cobrar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          {/* Contado sales */}
          {clientSales.filter((s) => s.paymentType === 'contado').map((s) => {
            const veh = vehicles.find((v) => v.id === s.vehicleId);
            return (
              <Card key={s.id}>
                <div className="flex items-center gap-3">
                  <Car size={18} className="text-green-600" />
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{veh ? vehicleLabel(veh.brand, veh.model, veh.year) : 'Vehículo'}</p>
                    <p className="text-sm text-slate-500">Venta al contado · {formatDate(s.saleDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-700">{formatCurrency(s.salePrice)}</p>
                    <Badge variant="success">Pagado</Badge>
                  </div>
                </div>
                {s.notes && <p className="text-sm text-slate-500 mt-2 pl-7">{s.notes}</p>}
              </Card>
            );
          })}

          {/* Vehículos vinculados sin venta formal */}
          {linkedVehicles.map((v) => (
            <Card key={v.id}>
              <div className="flex items-center gap-3">
                <Car size={18} className="text-brand-500" />
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{vehicleLabel(v.brand, v.model, v.year)}</p>
                  <p className="text-sm text-slate-500">
                    Vehículo vinculado · {v.patent}{v.soldDate ? ` · vendido ${formatDate(v.soldDate)}` : ''}
                  </p>
                </div>
                {v.soldPrice != null && (
                  <p className="text-lg font-bold text-slate-700">{formatCurrency(v.soldPrice)}</p>
                )}
              </div>
            </Card>
          ))}

          {clientSales.length === 0 && linkedVehicles.length === 0 && (
            <Card>
              <p className="text-center text-slate-400 py-4">Este cliente aún no tiene compras registradas.</p>
            </Card>
          )}
        </div>

        {/* Right: info */}
        <div className="space-y-5">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-semibold text-slate-900">Datos del cliente</p>
              <button
                onClick={openEditModal}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                title="Editar cliente"
              >
                <Edit2 size={14} />
              </button>
            </div>
            <dl className="space-y-2.5 text-sm">
              {[
                ['DNI', client.dni],
                ...(client.cuit ? [['CUIT', client.cuit] as [string, string]] : []),
                ['Teléfono', client.phone],
                ...(client.phone2 ? [['Teléfono 2', client.phone2] as [string, string]] : []),
                ['Email', client.email || '—'],
                ['Dirección', client.address],
                ['Ciudad', client.city],
                ['Provincia', client.province],
                ...(client.birthDate ? [['Fecha de nacimiento', formatDate(client.birthDate)] as [string, string]] : []),
              ].map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wide">{k}</dt>
                  <dd className="text-slate-900 mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
            {client.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Notas</p>
                <p className="text-sm text-slate-700 mt-1">{client.notes}</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Sale modal */}
      <Modal
        isOpen={showSaleModal}
        onClose={() => { setShowSaleModal(false); resetSaleForm(); }}
        title="Registrar venta"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowSaleModal(false); resetSaleForm(); }}>Cancelar</Button>
            <Button onClick={handleAddSale}>Confirmar venta</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Vehículo"
            value={saleForm.vehicleId}
            onChange={(e) => setSaleForm((f) => ({ ...f, vehicleId: e.target.value }))}
            options={availableVehicles.map((v) => ({ value: v.id, label: `${vehicleLabel(v.brand, v.model, v.year)} — ${formatCurrency(v.publishPrice)}` }))}
            placeholder="Seleccionar vehículo publicado"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Precio de venta ($)" type="number" value={saleForm.salePrice}
              onChange={(e) => setSaleForm((f) => ({ ...f, salePrice: +e.target.value }))}
            />
            <Input
              label="Fecha de venta" type="date" value={saleForm.saleDate}
              onChange={(e) => setSaleForm((f) => ({ ...f, saleDate: e.target.value }))}
            />
          </div>
          <Select
            label="Forma de pago"
            value={saleForm.paymentType}
            onChange={(e) => setSaleForm((f) => ({ ...f, paymentType: e.target.value as 'contado' | 'financiado' }))}
            options={[{ value: 'contado', label: 'Contado' }, { value: 'financiado', label: 'Financiado en cuotas' }]}
          />
          {saleForm.paymentType === 'financiado' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
              <Input
                label="Entrega / Seña ($)" type="number" value={saleForm.downPayment}
                onChange={(e) => setSaleForm((f) => ({ ...f, downPayment: +e.target.value }))}
              />
              <Input
                label="Cantidad de cuotas" type="number" value={saleForm.installments}
                onChange={(e) => setSaleForm((f) => ({ ...f, installments: +e.target.value }))}
              />
              {saleForm.salePrice > 0 && saleForm.installments > 0 && (
                <div className="col-span-1 sm:col-span-2 text-sm text-slate-700 bg-white rounded-lg p-3 border border-slate-200">
                  Cuota mensual: <span className="font-bold text-brand-600">
                    {formatCurrency((saleForm.salePrice - saleForm.downPayment) / saleForm.installments)}
                  </span>
                </div>
              )}
            </div>
          )}
          {/* Parte de pago */}
          <div className="border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Parte de pago (opcional)</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Auto entregado como parte de pago</label>
              <select
                value={saleForm.tradeInVehicleId}
                onChange={(e) => setSaleForm((f) => ({ ...f, tradeInVehicleId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600"
              >
                <option value="">— Sin parte de pago —</option>
                {vehicles.filter((v) => v.status !== 'vendido').map((v) => (
                  <option key={v.id} value={v.id}>{vehicleLabel(v.brand, v.model, v.year)} — {v.patent}</option>
                ))}
              </select>
            </div>
            {saleForm.tradeInVehicleId && (
              <Input
                label="Valor asignado al auto entregado ($)"
                type="number"
                value={saleForm.tradeInValue}
                onChange={(e) => setSaleForm((f) => ({ ...f, tradeInValue: +e.target.value }))}
              />
            )}
          </div>

          {/* Medios de pago */}
          <div className="border border-brand-200 bg-brand-50/40 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Medios de pago</p>

            {activeSenaForVehicle && saleForm.senaAplicada === 0 && (
              <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                <span className="text-amber-800">
                  Este vehículo tiene una seña activa de {formatCurrency(activeSenaForVehicle.amount)}.
                </span>
                <button
                  type="button"
                  onClick={() => setSaleForm((f) => ({ ...f, senaAplicada: activeSenaForVehicle.amount }))}
                  className="font-semibold text-amber-700 hover:underline"
                >
                  Aplicar seña
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Efectivo ($)" type="number" value={saleForm.payEfectivo}
                onChange={(e) => setSaleForm((f) => ({ ...f, payEfectivo: +e.target.value }))} />
              <Input label="Transferencia ($)" type="number" value={saleForm.payTransferencia}
                onChange={(e) => setSaleForm((f) => ({ ...f, payTransferencia: +e.target.value }))} />
              <Input label="Crédito prendario ($)" type="number" value={saleForm.payPrendario}
                onChange={(e) => setSaleForm((f) => ({ ...f, payPrendario: +e.target.value }))} />
              <Input label="Entidad del prendario (opcional)" value={saleForm.prendarioRef}
                onChange={(e) => setSaleForm((f) => ({ ...f, prendarioRef: e.target.value }))}
                placeholder="Ej: Banco Nación" />
              {saleForm.senaAplicada > 0 && (
                <Input label="Seña aplicada ($)" type="number" value={saleForm.senaAplicada}
                  onChange={(e) => setSaleForm((f) => ({ ...f, senaAplicada: +e.target.value }))} />
              )}
            </div>

            {/* Cheques */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  Cheques {chequesDraftTotal > 0 && <span className="text-slate-400">· {formatCurrency(chequesDraftTotal)}</span>}
                </span>
                <button type="button" onClick={addChequeDraft}
                  className="text-xs font-semibold text-brand-600 hover:underline inline-flex items-center gap-1">
                  <Plus size={12} /> Agregar cheque
                </button>
              </div>
              {saleForm.cheques.map((c, i) => (
                <div key={i} className="border border-slate-200 bg-white rounded-lg p-3 space-y-2 relative">
                  <button type="button" onClick={() => removeChequeDraft(i)}
                    className="absolute top-2 right-2 text-slate-300 hover:text-red-500" title="Quitar cheque">
                    <X size={14} />
                  </button>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Input label="N° cheque" value={c.numero} onChange={(e) => updateChequeDraft(i, { numero: e.target.value })} />
                    <Input label="Banco" value={c.banco} onChange={(e) => updateChequeDraft(i, { banco: e.target.value })} />
                    <Input label="Monto ($)" type="number" value={c.monto} onChange={(e) => updateChequeDraft(i, { monto: +e.target.value })} />
                    <Input label="Vencimiento" type="date" value={c.fechaVencimiento} onChange={(e) => updateChequeDraft(i, { fechaVencimiento: e.target.value })} />
                    <Input label="Librador" value={c.librador} onChange={(e) => updateChequeDraft(i, { librador: e.target.value })} />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo / Moneda</label>
                      <div className="flex gap-2">
                        <select value={c.tipo} onChange={(e) => updateChequeDraft(i, { tipo: e.target.value as 'al_dia' | 'diferido' })}
                          className="flex-1 px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                          <option value="al_dia">Al día</option>
                          <option value="diferido">Diferido</option>
                        </select>
                        <select value={c.moneda} onChange={(e) => updateChequeDraft(i, { moneda: e.target.value as 'ARS' | 'USD' })}
                          className="w-20 px-2 py-2 text-sm border border-slate-300 rounded-lg bg-white">
                          <option value="ARS">ARS</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {saleForm.cheques.length > 0 && (
                <p className="text-[11px] text-slate-400">Los cheques se registran automáticamente en el módulo Cheques (recibidos del cliente, en cartera).</p>
              )}
            </div>

            {/* Resumen asignado vs precio */}
            {saleForm.salePrice > 0 && (
              <div className={`text-sm rounded-lg px-3 py-2 ${
                Math.abs(assignedRemainder) < 1 ? 'bg-green-50 text-green-800'
                  : assignedRemainder > 0 ? 'bg-slate-100 text-slate-700' : 'bg-red-50 text-red-700'
              }`}>
                Asignado: <span className="font-bold">{formatCurrency(assignedTotal)}</span> de {formatCurrency(saleForm.salePrice)}
                {assignedRemainder > 0 && <span> · Resto {formatCurrency(assignedRemainder)} (financiado / pendiente)</span>}
                {assignedRemainder < 0 && <span> · Te pasaste por {formatCurrency(-assignedRemainder)}</span>}
              </div>
            )}
          </div>

          <Input
            label="Número de factura AFIP (opcional)"
            value={saleForm.invoiceNumber}
            onChange={(e) => setSaleForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
            placeholder="Ej: A-0001-00003456"
          />
          <Textarea
            label="Notas" value={saleForm.notes}
            onChange={(e) => setSaleForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Observaciones de la venta..."
          />
        </div>
      </Modal>

      {/* Edit client modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Editar cliente"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleEditSave}>Guardar cambios</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nombre" value={editForm.firstName}
            onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
            placeholder="Ej: Juan Carlos"
          />
          <Input
            label="Apellido" value={editForm.lastName}
            onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
            placeholder="Ej: Rodríguez"
          />
          <Input
            label="DNI" value={editForm.dni}
            onChange={(e) => setEditForm((f) => ({ ...f, dni: e.target.value }))}
            placeholder="Ej: 28.456.789"
          />
          <Input
            label="CUIT (opcional)" value={editForm.cuit}
            onChange={(e) => setEditForm((f) => ({ ...f, cuit: e.target.value }))}
            placeholder="Ej: 20-28456789-3"
          />
          <Input
            label="Teléfono" value={editForm.phone}
            onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Ej: 11-4567-8901"
          />
          <Input
            label="Teléfono 2 (opcional)" value={editForm.phone2}
            onChange={(e) => setEditForm((f) => ({ ...f, phone2: e.target.value }))}
            placeholder="Ej: 11-9876-5432"
          />
          <Input
            label="Email" value={editForm.email}
            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="Ej: cliente@gmail.com"
          />
          <Input
            label="Dirección" value={editForm.address}
            onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Ej: Av. Corrientes 1234"
          />
          <Input
            label="Ciudad" value={editForm.city}
            onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
            placeholder="Ej: Buenos Aires"
          />
          <Input
            label="Provincia" value={editForm.province}
            onChange={(e) => setEditForm((f) => ({ ...f, province: e.target.value }))}
            placeholder="Ej: Buenos Aires"
          />
          <Input
            label="Fecha de nacimiento (opcional)" type="date" value={editForm.birthDate}
            onChange={(e) => setEditForm((f) => ({ ...f, birthDate: e.target.value }))}
          />
          <div className="col-span-1 sm:col-span-2">
            <Textarea
              label="Notas" value={editForm.notes}
              onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Observaciones del cliente..."
            />
          </div>
        </div>
      </Modal>

      {/* Link vehicle modal */}
      <Modal
        isOpen={showLinkVehicleModal}
        onClose={() => { setShowLinkVehicleModal(false); setLinkVehicleId(''); }}
        title="Vincular vehículo vendido"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowLinkVehicleModal(false); setLinkVehicleId(''); }}>Cancelar</Button>
            <Button onClick={handleLinkVehicle} disabled={!linkVehicleId}>Vincular</Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Seleccioná un vehículo vendido para asociarlo como compra de <span className="font-semibold">{client.firstName} {client.lastName}</span>.
          </p>
          <Select
            label="Vehículo vendido sin comprador asignado"
            value={linkVehicleId}
            onChange={(e) => setLinkVehicleId(e.target.value)}
            options={soldVehiclesWithoutBuyer.map((v) => ({
              value: v.id,
              label: `${vehicleLabel(v.brand, v.model, v.year)} — ${v.patent}${v.soldDate ? ` (vendido ${formatDate(v.soldDate)})` : ''}`,
            }))}
            placeholder="Seleccionar vehículo"
          />
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Eliminar cliente"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Eliminar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-slate-700">
            ¿Eliminar a <span className="font-semibold">{client.firstName} {client.lastName}</span>? Esta acción no se puede deshacer.
          </p>
          {clientSales.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              Este cliente tiene {clientSales.length} venta{clientSales.length > 1 ? 's' : ''} registrada{clientSales.length > 1 ? 's' : ''}. Los registros de venta no serán eliminados.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
