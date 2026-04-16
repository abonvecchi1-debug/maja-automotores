// Batch endpoint: loads all data in one request for client initialization
import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const j = (s) => { try { return JSON.parse(s); } catch { return s; } };
const bool = (v) => v === 1;
const n = (v) => v ?? undefined;

const mapVehicle = (r) => ({
  id: r.id, brand: r.brand, model: r.model, year: r.year, km: r.km,
  color: r.color, patent: r.patent, status: r.status,
  purchasePrice: r.purchase_price, publishPrice: r.publish_price,
  soldPrice: n(r.sold_price), usdPrice: n(r.usd_price),
  purchaseDate: r.purchase_date, soldDate: n(r.sold_date),
  soldToClientId: n(r.sold_to_client_id), saleId: n(r.sale_id),
  tradeInVehicleId: n(r.trade_in_vehicle_id),
  checklist: j(r.checklist), documents: j(r.documents),
  images: j(r.images), publishLinks: j(r.publish_links), priceHistory: j(r.price_history),
  notes: r.notes, createdAt: r.created_at,
});
const mapClient = (r) => ({
  id: r.id, firstName: r.first_name, lastName: r.last_name, dni: r.dni,
  cuit: n(r.cuit), phone: r.phone, phone2: n(r.phone2), email: r.email,
  address: r.address, city: r.city, province: r.province, notes: r.notes, createdAt: r.created_at,
});
const mapSale = (r) => ({
  id: r.id, vehicleId: r.vehicle_id, clientId: r.client_id, saleDate: r.sale_date,
  salePrice: r.sale_price, paymentType: r.payment_type, downPayment: r.down_payment,
  installments: r.installments, installmentAmount: r.installment_amount,
  invoiceNumber: n(r.invoice_number), tradeInVehicleId: n(r.trade_in_vehicle_id),
  tradeInValue: n(r.trade_in_value), notes: r.notes, createdAt: r.created_at,
});
const mapPayment = (r) => ({
  id: r.id, saleId: r.sale_id, installmentNumber: r.installment_number,
  dueDate: r.due_date, amount: r.amount, paid: bool(r.paid), paidDate: n(r.paid_date),
});
const mapSupplier = (r) => ({
  id: r.id, name: r.name, type: r.type, phone: r.phone, email: r.email,
  address: r.address, cuit: r.cuit, notes: r.notes, createdAt: r.created_at,
});
const mapExpense = (r) => ({
  id: r.id, description: r.description, amount: r.amount, date: r.date,
  category: r.category, vehicleId: n(r.vehicle_id), supplierId: n(r.supplier_id),
  paid: bool(r.paid), paidDate: n(r.paid_date), notes: r.notes, createdAt: r.created_at,
});
const mapFET = (r) => ({
  id: r.id, name: r.name, category: r.category, defaultAmount: r.default_amount,
  dueDay: r.due_day, recurring: bool(r.recurring), active: bool(r.active), createdAt: r.created_at,
});
const mapFER = (r) => ({
  id: r.id, typeId: r.type_id, typeName: r.type_name, month: r.month,
  amount: r.amount, dueDate: r.due_date, paid: bool(r.paid), paidDate: n(r.paid_date),
});
const mapTask = (r) => ({
  id: r.id, title: r.title, description: r.description, status: r.status, priority: r.priority,
  vehicleId: n(r.vehicle_id), clientId: n(r.client_id), supplierId: n(r.supplier_id),
  dueDate: n(r.due_date), completedAt: n(r.completed_at), createdAt: r.created_at,
});
const mapTransaction = (r) => ({
  id: r.id, type: r.type, category: r.category, amount: r.amount,
  description: r.description, date: r.date,
  vehicleId: n(r.vehicle_id), clientId: n(r.client_id), supplierId: n(r.supplier_id),
  createdAt: r.created_at,
});
const mapTransfer = (r) => ({
  id: r.id, vehicleId: r.vehicle_id, clientId: n(r.client_id), gestorId: n(r.gestor_id),
  status: r.status, verificacionPolicial: bool(r.verificacion_policial),
  verificacionFecha: n(r.verificacion_fecha), informeDominio: bool(r.informe_dominio),
  informeDominioFecha: n(r.informe_dominio_fecha), formulario08Firmado: bool(r.formulario_08_firmado),
  tituloEntregado: bool(r.titulo_entregado), cedulaEntregada: bool(r.cedula_entregada),
  fechaEstimadaEntrega: n(r.fecha_estimada_entrega), fechaCompletado: n(r.fecha_completado),
  notes: r.notes, createdAt: r.created_at,
});
const mapLead = (r, history) => ({
  id: r.id, name: r.name, phone: r.phone, email: n(r.email), vehicleId: n(r.vehicle_id),
  source: r.source, status: r.status, notes: r.notes, createdAt: r.created_at,
  contactHistory: (history[r.id] ?? []).map((h) => ({ id: h.id, date: h.date, note: h.note })),
});
const mapDailyCash = (r) => ({
  id: r.id, date: r.date, openingBalance: r.opening_balance, closingBalance: n(r.closing_balance),
  closed: bool(r.closed), notes: r.notes, createdAt: r.created_at,
});
const mapMovement = (r) => ({
  id: r.id, dailyCashId: r.daily_cash_id, type: r.type, amount: r.amount,
  description: r.description, category: r.category, createdAt: r.created_at,
});
const mapTax = (r) => ({
  id: r.id, type: r.type, description: r.description, month: r.month,
  amount: r.amount, dueDate: r.due_date, paid: bool(r.paid), paidDate: n(r.paid_date),
  notes: r.notes, createdAt: r.created_at,
});

const SETTING_DEFAULTS = { iibbRate: 3, province: 'Buenos Aires', businessName: 'Maja Automotores', cuit: '', currency: 'ARS' };
const getSettings = () => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = { ...SETTING_DEFAULTS };
  for (const { key, value } of rows) { try { result[key] = JSON.parse(value); } catch { result[key] = value; } }
  return result;
};

router.get('/', (req, res) => {
  // Build contact history lookup for leads
  const historyRows = db.prepare('SELECT * FROM contact_history ORDER BY date ASC').all();
  const history = {};
  for (const h of historyRows) {
    if (!history[h.lead_id]) history[h.lead_id] = [];
    history[h.lead_id].push(h);
  }

  res.json({
    vehicles:             db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all().map(mapVehicle),
    clients:              db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all().map(mapClient),
    sales:                db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all().map(mapSale),
    installmentPayments:  db.prepare('SELECT * FROM installment_payments').all().map(mapPayment),
    suppliers:            db.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all().map(mapSupplier),
    expenses:             db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all().map(mapExpense),
    fixedExpenseTypes:    db.prepare('SELECT * FROM fixed_expense_types ORDER BY created_at DESC').all().map(mapFET),
    fixedExpenseRecords:  db.prepare('SELECT * FROM fixed_expense_records ORDER BY due_date ASC').all().map(mapFER),
    tasks:                db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all().map(mapTask),
    transactions:         db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all().map(mapTransaction),
    transfers:            db.prepare('SELECT * FROM transfers ORDER BY created_at DESC').all().map(mapTransfer),
    leads:                db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all().map((r) => mapLead(r, history)),
    dailyCashes:          db.prepare('SELECT * FROM daily_cashes ORDER BY date DESC').all().map(mapDailyCash),
    cashMovements:        db.prepare('SELECT * FROM cash_movements ORDER BY created_at ASC').all().map(mapMovement),
    taxPayments:          db.prepare('SELECT * FROM tax_payments ORDER BY month DESC, due_date ASC').all().map(mapTax),
    settings:             getSettings(),
  });
});

export default router;
