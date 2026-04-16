import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id, name: r.name, type: r.type, phone: r.phone,
  email: r.email, address: r.address, cuit: r.cuit, notes: r.notes, createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ suppliers: db.prepare('SELECT * FROM suppliers ORDER BY created_at DESC').all().map(map) });
});

router.post('/', (req, res) => {
  const s = req.body;
  const id = randomUUID();
  db.prepare('INSERT INTO suppliers (id,name,type,phone,email,address,cuit,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, s.name, s.type ?? 'otro', s.phone ?? '', s.email ?? '', s.address ?? '', s.cuit ?? '', s.notes ?? '', new Date().toISOString());
  res.status(201).json({ supplier: map(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Proveedor no encontrado' });
  const s = req.body;
  db.prepare('UPDATE suppliers SET name=?,type=?,phone=?,email=?,address=?,cuit=?,notes=? WHERE id=?')
    .run(s.name ?? ex.name, s.type ?? ex.type, s.phone ?? ex.phone, s.email ?? ex.email,
      s.address ?? ex.address, s.cuit ?? ex.cuit, s.notes ?? ex.notes, id);
  res.json({ supplier: map(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM suppliers WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Proveedor no encontrado' });
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
