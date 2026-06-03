import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const parseJSON = (s) => { try { return JSON.parse(s); } catch { return []; } };

const mapSale = (r) => ({
  id: r.id,
  vehicleId: r.vehicle_id,
  clientId: r.client_id,
  saleDate: r.sale_date,
  salePrice: r.sale_price,
  paymentType: r.payment_type,
  downPayment: r.down_payment,
  installments: r.installments,
  installmentAmount: r.installment_amount,
  invoiceNumber: r.invoice_number ?? undefined,
  tradeInVehicleId: r.trade_in_vehicle_id ?? undefined,
  tradeInValue: r.trade_in_value ?? undefined,
  paymentMethods: parseJSON(r.payment_methods ?? '[]'),
  notes: r.notes,
  createdAt: r.created_at,
});

const mapPayment = (r) => ({
  id: r.id,
  saleId: r.sale_id,
  installmentNumber: r.installment_number,
  dueDate: r.due_date,
  amount: r.amount,
  paid: r.paid === 1,
  paidDate: r.paid_date ?? undefined,
});

const mapChequeRow = (r) => ({
  id: r.id, numero: r.numero, serie: r.serie ?? '', banco: r.banco, monto: r.monto,
  moneda: r.moneda, fechaEmision: r.fecha_emision, fechaVencimiento: r.fecha_vencimiento,
  tipo: r.tipo, alPortador: r.al_portador === 1, endosado: r.endosado === 1,
  endosadoPor: r.endosado_por ?? '', dniEndosante: r.dni_endosante ?? '',
  librador: r.librador, cuitLibrador: r.cuit_librador, recibidoDe: r.recibido_de,
  entregadoA: r.entregado_a, estado: r.estado, observaciones: r.observaciones,
  saleId: r.sale_id ?? undefined, createdAt: r.created_at,
});

router.get('/', (req, res) => {
  const sales = db.prepare('SELECT * FROM sales ORDER BY created_at DESC').all().map(mapSale);
  const installmentPayments = db.prepare('SELECT * FROM installment_payments').all().map(mapPayment);
  res.json({ sales, installmentPayments });
});

// Creates sale + installment payments + marks vehicle as sold, all in one transaction
router.post('/', (req, res) => {
  const { sale, payments, cheques } = req.body;
  const saleId = randomUUID();
  const now = new Date().toISOString();

  const insertSale = db.transaction(() => {
    db.prepare(`
      INSERT INTO sales (id,vehicle_id,client_id,sale_date,sale_price,payment_type,down_payment,
        installments,installment_amount,invoice_number,trade_in_vehicle_id,trade_in_value,payment_methods,notes,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      saleId, sale.vehicleId, sale.clientId, sale.saleDate, sale.salePrice,
      sale.paymentType, sale.downPayment ?? 0, sale.installments ?? 0,
      sale.installmentAmount ?? 0, sale.invoiceNumber ?? null,
      sale.tradeInVehicleId ?? null, sale.tradeInValue ?? null,
      JSON.stringify(sale.paymentMethods ?? []),
      sale.notes ?? '', now
    );

    const insertPayment = db.prepare(`
      INSERT INTO installment_payments (id,sale_id,installment_number,due_date,amount,paid,paid_date)
      VALUES (?,?,?,?,?,?,?)
    `);
    const createdPayments = (payments ?? []).map((p) => {
      const pid = randomUUID();
      insertPayment.run(pid, saleId, p.installmentNumber, p.dueDate, p.amount, p.paid ? 1 : 0, p.paidDate ?? null);
      return pid;
    });

    // Cheques recibidos como parte del pago → se registran en el módulo de cheques
    const client = db.prepare('SELECT first_name, last_name FROM clients WHERE id = ?').get(sale.clientId);
    const clientName = client ? `${client.first_name} ${client.last_name}`.trim() : '';
    const insertCheque = db.prepare(`INSERT INTO cheques
      (id,numero,serie,banco,monto,moneda,fecha_emision,fecha_vencimiento,tipo,al_portador,endosado,endosado_por,dni_endosante,
       librador,cuit_librador,recibido_de,entregado_a,estado,observaciones,sale_id,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const createdChequeIds = (cheques ?? []).map((c) => {
      const cid = randomUUID();
      insertCheque.run(
        cid, c.numero ?? '', c.serie ?? '', c.banco ?? '', c.monto ?? 0, c.moneda ?? 'ARS',
        c.fechaEmision ?? '', c.fechaVencimiento ?? '', c.tipo ?? 'al_dia',
        c.alPortador ? 1 : 0, c.endosado ? 1 : 0, c.endosadoPor ?? '', c.dniEndosante ?? '',
        c.librador ?? '', c.cuitLibrador ?? '', c.recibidoDe || clientName,
        c.entregadoA ?? '', c.estado ?? 'en_cartera', c.observaciones ?? '', saleId, now,
      );
      return cid;
    });

    db.prepare(`
      UPDATE vehicles SET status='vendido', sold_price=?, sold_date=?, sold_to_client_id=?, sale_id=?
      WHERE id=?
    `).run(sale.salePrice, sale.saleDate, sale.clientId, saleId, sale.vehicleId);

    return { saleId, paymentIds: createdPayments, chequeIds: createdChequeIds };
  });

  const { saleId: sid, paymentIds, chequeIds } = insertSale();
  const createdSale = mapSale(db.prepare('SELECT * FROM sales WHERE id = ?').get(sid));
  const createdPayments = paymentIds.map((pid) => mapPayment(db.prepare('SELECT * FROM installment_payments WHERE id = ?').get(pid)));
  const createdCheques = chequeIds.map((cid) => mapChequeRow(db.prepare('SELECT * FROM cheques WHERE id = ?').get(cid)));
  res.status(201).json({ sale: createdSale, payments: createdPayments, cheques: createdCheques });
});

router.put('/installments/:id/pay', (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT id FROM installment_payments WHERE id = ?').get(id)) return res.status(404).json({ error: 'Cuota no encontrada' });
  const today = new Date().toISOString().split('T')[0];
  db.prepare('UPDATE installment_payments SET paid=1, paid_date=? WHERE id=?').run(today, id);
  res.json({ payment: mapPayment(db.prepare('SELECT * FROM installment_payments WHERE id = ?').get(id)) });
});

export default router;
