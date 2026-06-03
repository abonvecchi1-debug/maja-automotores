import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id, type: r.type, vehicleId: r.vehicle_id ?? undefined, clientId: r.client_id ?? undefined,
  counterpartyName: r.counterparty_name ?? '', amount: r.amount, method: r.method,
  date: r.date, status: r.status, notes: r.notes, createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ senas: db.prepare('SELECT * FROM senas ORDER BY created_at DESC').all().map(map) });
});

router.post('/', (req, res) => {
  const s = req.body;
  const id = randomUUID();
  db.prepare(`INSERT INTO senas (id,type,vehicle_id,client_id,counterparty_name,amount,method,date,status,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, s.type ?? 'venta', s.vehicleId ?? null, s.clientId ?? null,
      s.counterpartyName ?? '', s.amount ?? 0, s.method ?? 'efectivo',
      s.date ?? new Date().toISOString().split('T')[0], s.status ?? 'activa',
      s.notes ?? '', new Date().toISOString());
  res.status(201).json({ sena: map(db.prepare('SELECT * FROM senas WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM senas WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Seña no encontrada' });
  const s = req.body;
  db.prepare(`UPDATE senas SET type=?,vehicle_id=?,client_id=?,counterparty_name=?,amount=?,method=?,date=?,status=?,notes=? WHERE id=?`)
    .run(
      s.type ?? ex.type,
      s.vehicleId !== undefined ? (s.vehicleId ?? null) : ex.vehicle_id,
      s.clientId !== undefined ? (s.clientId ?? null) : ex.client_id,
      s.counterpartyName !== undefined ? s.counterpartyName : ex.counterparty_name,
      s.amount !== undefined ? s.amount : ex.amount,
      s.method ?? ex.method,
      s.date ?? ex.date,
      s.status ?? ex.status,
      s.notes !== undefined ? s.notes : ex.notes,
      id,
    );
  res.json({ sena: map(db.prepare('SELECT * FROM senas WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM senas WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Seña no encontrada' });
  db.prepare('DELETE FROM senas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
