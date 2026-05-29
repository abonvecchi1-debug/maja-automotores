// ─── Enums / Union types ───────────────────────────────────────────────────

export type VehicleStatus = 'comprado' | 'preparacion' | 'publicado' | 'vendido';
export type SupplierType = 'mecanico' | 'repuestero' | 'lavadero' | 'gestor' | 'otro';
export type TaskStatus = 'pendiente' | 'en_proceso' | 'terminado';
export type TaskPriority = 'baja' | 'media' | 'alta';
export type PaymentType = 'contado' | 'financiado';

// ─── Vehicles ─────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  km: number;
  color: string;
  patent: string;
  status: VehicleStatus;
  purchasePrice: number;
  publishPrice: number;
  soldPrice?: number;
  purchaseDate: string;
  soldDate?: string;
  soldToClientId?: string;
  saleId?: string;
  checklist: {
    lavado: boolean;
    pulido: boolean;
    mecanica: boolean;
    papeles: boolean;
  };
  images: string[];
  notes: string;
  createdAt: string;
  // NEW fields
  usdPrice?: number;           // precio referencia en USD
  publishLinks?: string[];     // links a MercadoLibre, Facebook, etc.
  priceHistory?: { date: string; price: number }[];
  tradeInVehicleId?: string;   // si fue recibido como parte de pago
  // Document checklist
  documents: {
    titulo: boolean;
    cedulaVerde: boolean;
    cedulaAzul: boolean;
    vtv: boolean;
    libreDeuda: boolean;
    verificacionPolicial: boolean;
    seguro: boolean;
  };
}

// ─── Expenses ─────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;        // 'mecanica' | 'lavado' | 'repuestos' | 'gestion' | 'otro'
  vehicleId?: string;      // si es gasto de vehículo
  supplierId?: string;     // si tiene proveedor
  paid: boolean;
  paidDate?: string;
  notes: string;
  createdAt: string;
}

// ─── Clients ──────────────────────────────────────────────────────────────

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dni: string;
  cuit?: string;
  phone: string;
  phone2?: string;
  email: string;
  address: string;
  city: string;
  province: string;
  notes: string;
  birthDate?: string;
  createdAt: string;
}

// ─── Sales ────────────────────────────────────────────────────────────────

export interface Sale {
  id: string;
  vehicleId: string;
  clientId: string;
  saleDate: string;
  salePrice: number;
  paymentType: PaymentType;
  downPayment: number;      // 0 si es contado
  installments: number;     // 0 si es contado
  installmentAmount: number;
  invoiceNumber?: string;   // número de factura AFIP
  tradeInVehicleId?: string; // auto entregado en parte de pago
  tradeInValue?: number;    // valor asignado al auto de parte de pago
  notes: string;
  createdAt: string;
}

export interface InstallmentPayment {
  id: string;
  saleId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  paidDate?: string;
  paid: boolean;
}

// ─── Suppliers ────────────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  type: SupplierType;
  phone: string;
  email: string;
  address: string;
  cuit: string;
  notes: string;
  createdAt: string;
}

// ─── Fixed Expenses ───────────────────────────────────────────────────────

export interface FixedExpenseType {
  id: string;
  name: string;
  category: string;
  defaultAmount: number;
  dueDay: number;           // día del mes en que vence
  recurring: boolean;
  active: boolean;
  createdAt: string;
}

export interface FixedExpenseRecord {
  id: string;
  typeId: string;
  typeName: string;
  month: string;            // formato YYYY-MM
  amount: number;
  dueDate: string;
  paid: boolean;
  paidDate?: string;
}

// ─── Tasks ────────────────────────────────────────────────────────────────

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  vehicleId?: string;
  clientId?: string;
  supplierId?: string;
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

// ─── Transactions (cash flow) ────────────────────────────────────────────

export interface Transaction {
  id: string;
  type: 'ingreso' | 'egreso';
  category: string;
  amount: number;
  description: string;
  date: string;
  vehicleId?: string;
  clientId?: string;
  supplierId?: string;
  createdAt: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  iibbRate: number;         // porcentaje (ej: 3)
  province: string;
  businessName: string;
  cuit: string;
  currency: string;
  usdRate?: number;         // cotización USD manual
  usdRateUpdated?: string;  // fecha última actualización
}

// ─── Transfer08 (Formulario 08 / Transferencia vehicular) ─────────────────

export type Transfer08Status = 'pendiente' | 'en_tramite' | 'completado';

export interface Transfer08 {
  id: string;
  vehicleId: string;
  clientId?: string;       // comprador
  gestorId?: string;       // proveedor gestor asignado
  status: Transfer08Status;
  // Documentación
  verificacionPolicial: boolean;
  verificacionFecha?: string;
  informeDominio: boolean;
  informeDominioFecha?: string;
  formulario08Firmado: boolean;
  tituloEntregado: boolean;
  cedulaEntregada: boolean;
  fechaEstimadaEntrega?: string;
  fechaCompletado?: string;
  notes: string;
  createdAt: string;
}

// ─── Lead (Consultas / Leads) ─────────────────────────────────────────────

export type LeadStatus = 'consulta' | 'interesado' | 'negociando' | 'descartado' | 'compro';
export type LeadSource = 'whatsapp' | 'mercadolibre' | 'facebook' | 'instagram' | 'olx' | 'presencial' | 'referido' | 'otro';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicleId?: string;      // vehículo que le interesa
  source: LeadSource;
  status: LeadStatus;
  notes: string;
  contactHistory: ContactEntry[];
  createdAt: string;
}

export interface ContactEntry {
  id: string;
  date: string;
  note: string;
}

// ─── DailyCash (Caja diaria) ──────────────────────────────────────────────

export interface DailyCash {
  id: string;
  date: string;            // YYYY-MM-DD
  openingBalance: number;
  closingBalance?: number;
  closed: boolean;
  notes: string;
  createdAt: string;
}

export interface CashMovement {
  id: string;
  dailyCashId: string;
  type: 'ingreso' | 'egreso';
  category: string;        // 'venta' | 'cuota' | 'proveedor' | 'gasto_fijo' | 'retiro' | 'otro'
  description: string;
  amount: number;
  createdAt: string;
}

// ─── Tax Payments (registro de pagos impositivos) ─────────────────────────

export type TaxType = 'iibb' | 'monotributo' | 'responsable_inscripto' | 'autonomos' | 'ganancias' | 'otro';

export interface TaxPayment {
  id: string;
  type: TaxType;
  description: string;     // nombre libre, ej: "IIBB Mayo 2025"
  month: string;           // YYYY-MM
  amount: number;
  dueDate: string;
  paid: boolean;
  paidDate?: string;
  notes: string;
  createdAt: string;
}
