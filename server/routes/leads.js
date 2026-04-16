import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const mapLead = (r) => ({
  id: r.id, name: r.name, phone: r.phone, email: r.email ?? undefined,
  vehicleId: r.vehicle_id ?? undefined, source: r.source, status: r.status,
  notes: r.notes, createdAt: r.created_at,
  contactHistory: db.prepare('SELECT * FROM contact_history WHERE lead_id=? ORDER BY date ASC').all(r.id)
    .map((h) => ({ id: h.id, date: h.date, note: h.note })),
});

router.get('/', (req, res) => {
  res.json({ leads: db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all().map(mapLead) });
});

router.post('/', (req, res) => {
  const l = req.body;
  const id = randomUUID();
  db.prepare('INSERT INTO leads (id,name,phone,email,vehicle_id,source,status,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, l.name, l.phone, l.email ?? null, l.vehicleId ?? null, l.source ?? 'otro', l.status ?? 'consulta', l.notes ?? '', new Date().toISOString());
  res.status(201).json({ lead: mapLead(db.prepare('SELECT * FROM leads WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Consulta no encontrada' });
  const l = req.body;
  db.prepare('UPDATE leads SET name=?,phone=?,email=?,vehicle_id=?,source=?,status=?,notes=? WHERE id=?')
    .run(l.name ?? ex.name, l.phone ?? ex.phone,
      l.email !== undefined ? (l.email ?? null) : ex.email,
      l.vehicleId !== undefined ? (l.vehicleId ?? null) : ex.vehicle_id,
      l.source ?? ex.source, l.status ?? ex.status, l.notes ?? ex.notes, id);
  res.json({ lead: mapLead(db.prepare('SELECT * FROM leads WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM leads WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Consulta no encontrada' });
  db.prepare('DELETE FROM contact_history WHERE lead_id = ?').run(req.params.id);
  db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/contact', (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT id FROM leads WHERE id = ?').get(id)) return res.status(404).json({ error: 'Consulta no encontrada' });
  const entryId = randomUUID();
  db.prepare('INSERT INTO contact_history (id,lead_id,date,note) VALUES (?,?,?,?)')
    .run(entryId, id, new Date().toISOString(), req.body.note ?? '');
  res.status(201).json({ entry: { id: entryId, date: new Date().toISOString(), note: req.body.note ?? '' } });
});

export default router;
