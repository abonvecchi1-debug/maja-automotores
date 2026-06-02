import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id, type: r.type, category: r.category, amount: r.amount,
  description: r.description, date: r.date,
  vehicleId: r.vehicle_id ?? undefined, clientId: r.client_id ?? undefined,
  supplierId: r.supplier_id ?? undefined,
  paid: r.paid === 1, paidDate: r.paid_date ?? undefined,
  createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ transactions: db.prepare('SELECT * FROM transactions ORDER BY date DESC, created_at DESC').all().map(map) });
});

router.post('/', (req, res) => {
  const t = req.body;
  const id = randomUUID();
  // Los ingresos se consideran cobrados siempre. Los egresos pueden quedar pendientes.
  const paid = t.type === 'egreso' ? (t.paid ? 1 : 0) : 1;
  const paidDate = paid ? (t.paidDate ?? t.date) : null;
  db.prepare('INSERT INTO transactions (id,type,category,amount,description,date,vehicle_id,client_id,supplier_id,paid,paid_date,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, t.type, t.category ?? '', t.amount, t.description, t.date,
      t.vehicleId ?? null, t.clientId ?? null, t.supplierId ?? null, paid, paidDate, new Date().toISOString());
  res.status(201).json({ transaction: map(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id)) });
});

// Marcar un egreso como pagado (o revertir a pendiente con { paid: false })
router.put('/:id/pay', (req, res) => {
  if (!db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Transacción no encontrada' });
  const paid = req.body?.paid === false ? 0 : 1;
  db.prepare('UPDATE transactions SET paid=?, paid_date=? WHERE id=?')
    .run(paid, paid ? new Date().toISOString().split('T')[0] : null, req.params.id);
  res.json({ transaction: map(db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM transactions WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Transacción no encontrada' });
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
