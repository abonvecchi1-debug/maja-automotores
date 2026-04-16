import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id, description: r.description, amount: r.amount, date: r.date,
  category: r.category, vehicleId: r.vehicle_id ?? undefined, supplierId: r.supplier_id ?? undefined,
  paid: r.paid === 1, paidDate: r.paid_date ?? undefined, notes: r.notes, createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ expenses: db.prepare('SELECT * FROM expenses ORDER BY created_at DESC').all().map(map) });
});

router.post('/', (req, res) => {
  const e = req.body;
  const id = randomUUID();
  db.prepare('INSERT INTO expenses (id,description,amount,date,category,vehicle_id,supplier_id,paid,paid_date,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, e.description, e.amount, e.date, e.category ?? 'otro', e.vehicleId ?? null, e.supplierId ?? null,
      e.paid ? 1 : 0, e.paidDate ?? null, e.notes ?? '', new Date().toISOString());
  res.status(201).json({ expense: map(db.prepare('SELECT * FROM expenses WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Gasto no encontrado' });
  const e = req.body;
  db.prepare('UPDATE expenses SET description=?,amount=?,date=?,category=?,vehicle_id=?,supplier_id=?,paid=?,paid_date=?,notes=? WHERE id=?')
    .run(e.description ?? ex.description, e.amount ?? ex.amount, e.date ?? ex.date,
      e.category ?? ex.category, e.vehicleId !== undefined ? (e.vehicleId ?? null) : ex.vehicle_id,
      e.supplierId !== undefined ? (e.supplierId ?? null) : ex.supplier_id,
      e.paid !== undefined ? (e.paid ? 1 : 0) : ex.paid,
      e.paidDate !== undefined ? (e.paidDate ?? null) : ex.paid_date,
      e.notes ?? ex.notes, id);
  res.json({ expense: map(db.prepare('SELECT * FROM expenses WHERE id = ?').get(id)) });
});

router.put('/:id/pay', (req, res) => {
  if (!db.prepare('SELECT id FROM expenses WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Gasto no encontrado' });
  db.prepare('UPDATE expenses SET paid=1, paid_date=? WHERE id=?').run(new Date().toISOString().split('T')[0], req.params.id);
  res.json({ expense: map(db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM expenses WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Gasto no encontrado' });
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
