import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  dni: r.dni,
  cuit: r.cuit ?? undefined,
  phone: r.phone,
  phone2: r.phone2 ?? undefined,
  email: r.email,
  address: r.address,
  city: r.city,
  province: r.province,
  notes: r.notes,
  createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ clients: db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all().map(map) });
});

router.post('/', (req, res) => {
  const c = req.body;
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO clients (id,first_name,last_name,dni,cuit,phone,phone2,email,address,city,province,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id, c.firstName, c.lastName, c.dni ?? '', c.cuit ?? null, c.phone ?? '', c.phone2 ?? null,
    c.email ?? '', c.address ?? '', c.city ?? '', c.province ?? '', c.notes ?? '', now);
  res.status(201).json({ client: map(db.prepare('SELECT * FROM clients WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const c = req.body;
  const ex = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Cliente no encontrado' });
  db.prepare(`
    UPDATE clients SET first_name=?,last_name=?,dni=?,cuit=?,phone=?,phone2=?,email=?,address=?,city=?,province=?,notes=?
    WHERE id=?
  `).run(
    c.firstName ?? ex.first_name, c.lastName ?? ex.last_name, c.dni ?? ex.dni,
    c.cuit !== undefined ? (c.cuit || null) : ex.cuit,
    c.phone ?? ex.phone, c.phone2 !== undefined ? (c.phone2 || null) : ex.phone2,
    c.email ?? ex.email, c.address ?? ex.address, c.city ?? ex.city,
    c.province ?? ex.province, c.notes ?? ex.notes, id
  );
  res.json({ client: map(db.prepare('SELECT * FROM clients WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Cliente no encontrado' });
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
