import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id, title: r.title, description: r.description, status: r.status, priority: r.priority,
  vehicleId: r.vehicle_id ?? undefined, clientId: r.client_id ?? undefined,
  supplierId: r.supplier_id ?? undefined, dueDate: r.due_date ?? undefined,
  completedAt: r.completed_at ?? undefined, createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ tasks: db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all().map(map) });
});

router.post('/', (req, res) => {
  const t = req.body;
  const id = randomUUID();
  db.prepare('INSERT INTO tasks (id,title,description,status,priority,vehicle_id,client_id,supplier_id,due_date,completed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, t.title, t.description ?? '', t.status ?? 'pendiente', t.priority ?? 'media',
      t.vehicleId ?? null, t.clientId ?? null, t.supplierId ?? null,
      t.dueDate ?? null, t.completedAt ?? null, new Date().toISOString());
  res.status(201).json({ task: map(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Tarea no encontrada' });
  const t = req.body;
  const completedAt = t.status === 'terminado' && !ex.completed_at ? new Date().toISOString() : (t.completedAt !== undefined ? t.completedAt : ex.completed_at);
  db.prepare('UPDATE tasks SET title=?,description=?,status=?,priority=?,vehicle_id=?,client_id=?,supplier_id=?,due_date=?,completed_at=? WHERE id=?')
    .run(t.title ?? ex.title, t.description ?? ex.description, t.status ?? ex.status,
      t.priority ?? ex.priority,
      t.vehicleId !== undefined ? (t.vehicleId ?? null) : ex.vehicle_id,
      t.clientId !== undefined ? (t.clientId ?? null) : ex.client_id,
      t.supplierId !== undefined ? (t.supplierId ?? null) : ex.supplier_id,
      t.dueDate !== undefined ? (t.dueDate ?? null) : ex.due_date,
      completedAt ?? null, id);
  res.json({ task: map(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Tarea no encontrada' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
