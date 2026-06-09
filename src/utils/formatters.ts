import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Currency ─────────────────────────────────────────────────────────────

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatCurrencyShort = (amount: number): string => {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return formatCurrency(amount);
};

// ─── Dates ────────────────────────────────────────────────────────────────

export const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return '-';
    return format(d, 'dd/MM/yyyy');
  } catch {
    return '-';
  }
};

export const formatDateLong = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  try {
    const d = parseISO(dateStr);
    if (!isValid(d)) return '-';
    return format(d, "d 'de' MMMM 'de' yyyy", { locale: es });
  } catch {
    return '-';
  }
};

export const formatMonthLabel = (month: string): string => {
  // month = YYYY-MM
  try {
    const d = parseISO(`${month}-01`);
    return format(d, 'MMMM yyyy', { locale: es });
  } catch {
    return month;
  }
};

export const getCurrentMonth = (): string => {
  return new Date().toISOString().slice(0, 7);
};

export const getToday = (): string => {
  return new Date().toISOString().split('T')[0];
};

// ─── Numbers ──────────────────────────────────────────────────────────────

export const formatKm = (km: number): string => {
  return new Intl.NumberFormat('es-AR').format(km) + ' km';
};

export const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// ─── Vehicle helpers ──────────────────────────────────────────────────────

export const vehicleLabel = (brand: string, model: string, year: number): string =>
  `${brand} ${model} ${year}`;

export const statusLabel: Record<string, string> = {
  comprado: 'Comprado',
  preparacion: 'En Preparación',
  publicado: 'Publicado',
  señado: 'Señado',
  vendido: 'Vendido',
};

export const statusColor: Record<string, string> = {
  comprado: 'bg-slate-100 text-slate-700',
  preparacion: 'bg-amber-100 text-amber-800',
  publicado: 'bg-blue-100 text-blue-800',
  señado: 'bg-purple-100 text-purple-800',
  vendido: 'bg-green-100 text-green-800',
};

export const supplierTypeLabel: Record<string, string> = {
  mecanico: 'Mecánico',
  repuestero: 'Repuestero',
  lavadero: 'Lavadero',
  gestor: 'Gestor',
  agencia: 'Agencia',
  otro: 'Otro',
};

export const supplierTypeColor: Record<string, string> = {
  mecanico: 'bg-blue-100 text-blue-800',
  repuestero: 'bg-purple-100 text-purple-800',
  lavadero: 'bg-cyan-100 text-cyan-800',
  gestor: 'bg-orange-100 text-orange-800',
  agencia: 'bg-emerald-100 text-emerald-800',
  otro: 'bg-slate-100 text-slate-700',
};

export const taskStatusLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En Proceso',
  terminado: 'Terminado',
};

export const taskStatusColor: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  en_proceso: 'bg-amber-100 text-amber-800',
  terminado: 'bg-green-100 text-green-800',
};

export const taskPriorityLabel: Record<string, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

export const taskPriorityColor: Record<string, string> = {
  baja: 'bg-slate-100 text-slate-600',
  media: 'bg-amber-100 text-amber-800',
  alta: 'bg-red-100 text-red-800',
};

// ─── Leads ────────────────────────────────────────────────────────────────

export const leadStatusLabel: Record<string, string> = {
  consulta: 'Consulta',
  interesado: 'Interesado',
  negociando: 'Negociando',
  descartado: 'Descartado',
  compro: 'Compró',
};

export const leadStatusColor: Record<string, string> = {
  consulta: 'bg-slate-100 text-slate-700',
  interesado: 'bg-blue-100 text-blue-800',
  negociando: 'bg-amber-100 text-amber-800',
  descartado: 'bg-red-100 text-red-800',
  compro: 'bg-green-100 text-green-800',
};

export const leadSourceLabel: Record<string, string> = {
  whatsapp: 'WhatsApp',
  mercadolibre: 'MercadoLibre',
  facebook: 'Facebook',
  instagram: 'Instagram',
  olx: 'OLX',
  presencial: 'Presencial',
  referido: 'Referido',
  otro: 'Otro',
};

export const leadSourceColor: Record<string, string> = {
  whatsapp: 'bg-green-100 text-green-800',
  mercadolibre: 'bg-yellow-100 text-yellow-800',
  facebook: 'bg-blue-100 text-blue-800',
  instagram: 'bg-pink-100 text-pink-800',
  olx: 'bg-orange-100 text-orange-800',
  presencial: 'bg-slate-100 text-slate-700',
  referido: 'bg-purple-100 text-purple-800',
  otro: 'bg-slate-100 text-slate-600',
};

// ─── Transfers ────────────────────────────────────────────────────────────

export const transfer08StatusLabel: Record<string, string> = {
  pendiente: 'Pendiente',
  en_tramite: 'En Trámite',
  completado: 'Completado',
};

export const transfer08StatusColor: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  en_tramite: 'bg-amber-100 text-amber-800',
  completado: 'bg-green-100 text-green-800',
};
