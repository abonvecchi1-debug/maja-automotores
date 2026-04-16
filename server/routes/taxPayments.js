import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id, type: r.type, description: r.description, month: r.month,
  amount: r.amount, dueDate: r.due_date, paid: r.paid === 1,
  paidDate: r.paid_date ?? undefined, notes: r.notes, createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ taxPayments: db.prepare('SELECT * FROM tax_payments ORDER BY month DESC, due_date ASC').all().map(map) });
});

router.post('/', (req, res) => {
  const t = req.body;
  const id = randomUUID();
  db.prepare('INSERT INTO tax_payments (id,type,description,month,amount,due_date,paid,paid_date,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(id, t.type, t.description, t.month, t.amount ?? 0, t.dueDate, t.paid ? 1 : 0, t.paidDate ?? null, t.notes ?? '', new Date().toISOString());
  res.status(201).json({ taxPayment: map(db.prepare('SELECT * FROM tax_payments WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM tax_payments WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Pago no encontrado' });
  const t = req.body;
  db.prepare('UPDATE tax_payments SET type=?,description=?,month=?,amount=?,due_date=?,paid=?,paid_date=?,notes=? WHERE id=?')
    .run(t.type ?? ex.type, t.description ?? ex.description, t.month ?? ex.month,
      t.amount !== undefined ? t.amount : ex.amount, t.dueDate ?? ex.due_date,
      t.paid !== undefined ? (t.paid ? 1 : 0) : ex.paid,
      t.paidDate !== undefined ? (t.paidDate ?? null) : ex.paid_date,
      t.notes ?? ex.notes, id);
  res.json({ taxPayment: map(db.prepare('SELECT * FROM tax_payments WHERE id = ?').get(id)) });
});

router.put('/:id/pay', (req, res) => {
  if (!db.prepare('SELECT id FROM tax_payments WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Pago no encontrado' });
  db.prepare('UPDATE tax_payments SET paid=1, paid_date=? WHERE id=?')
    .run(new Date().toISOString().split('T')[0], req.params.id);
  res.json({ taxPayment: map(db.prepare('SELECT * FROM tax_payments WHERE id = ?').get(req.params.id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM tax_payments WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Pago no encontrado' });
  db.prepare('DELETE FROM tax_payments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
