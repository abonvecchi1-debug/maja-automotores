import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const mapType = (r) => ({
  id: r.id, name: r.name, category: r.category, defaultAmount: r.default_amount,
  dueDay: r.due_day, recurring: r.recurring === 1, active: r.active === 1, createdAt: r.created_at,
});

const mapRecord = (r) => ({
  id: r.id, typeId: r.type_id, typeName: r.type_name, month: r.month,
  amount: r.amount, dueDate: r.due_date, paid: r.paid === 1, paidDate: r.paid_date ?? undefined,
});

// Types
router.get('/types', (req, res) => {
  res.json({ types: db.prepare('SELECT * FROM fixed_expense_types ORDER BY created_at DESC').all().map(mapType) });
});

router.post('/types', (req, res) => {
  const t = req.body;
  const id = randomUUID();
  db.prepare('INSERT INTO fixed_expense_types (id,name,category,default_amount,due_day,recurring,active,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, t.name, t.category ?? 'otro', t.defaultAmount ?? 0, t.dueDay ?? 10, t.recurring ? 1 : 0, t.active !== false ? 1 : 0, new Date().toISOString());
  res.status(201).json({ type: mapType(db.prepare('SELECT * FROM fixed_expense_types WHERE id = ?').get(id)) });
});

router.put('/types/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM fixed_expense_types WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Tipo no encontrado' });
  const t = req.body;
  db.prepare('UPDATE fixed_expense_types SET name=?,category=?,default_amount=?,due_day=?,recurring=?,active=? WHERE id=?')
    .run(t.name ?? ex.name, t.category ?? ex.category, t.defaultAmount ?? ex.default_amount,
      t.dueDay ?? ex.due_day, t.recurring !== undefined ? (t.recurring ? 1 : 0) : ex.recurring,
      t.active !== undefined ? (t.active ? 1 : 0) : ex.active, id);
  res.json({ type: mapType(db.prepare('SELECT * FROM fixed_expense_types WHERE id = ?').get(id)) });
});

router.delete('/types/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM fixed_expense_types WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Tipo no encontrado' });
  db.prepare('DELETE FROM fixed_expense_types WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Records
router.get('/records', (req, res) => {
  res.json({ records: db.prepare('SELECT * FROM fixed_expense_records ORDER BY due_date ASC').all().map(mapRecord) });
});

router.post('/records', (req, res) => {
  const r = req.body;
  const id = randomUUID();
  db.prepare('INSERT INTO fixed_expense_records (id,type_id,type_name,month,amount,due_date,paid,paid_date) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, r.typeId ?? '', r.typeName, r.month, r.amount ?? 0, r.dueDate, r.paid ? 1 : 0, r.paidDate ?? null);
  res.status(201).json({ record: mapRecord(db.prepare('SELECT * FROM fixed_expense_records WHERE id = ?').get(id)) });
});

router.put('/records/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM fixed_expense_records WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Registro no encontrado' });
  const r = req.body;
  db.prepare('UPDATE fixed_expense_records SET type_name=?,amount=?,due_date=?,paid=?,paid_date=? WHERE id=?')
    .run(r.typeName ?? ex.type_name, r.amount !== undefined ? r.amount : ex.amount,
      r.dueDate ?? ex.due_date, r.paid !== undefined ? (r.paid ? 1 : 0) : ex.paid,
      r.paidDate !== undefined ? (r.paidDate ?? null) : ex.paid_date, id);
  res.json({ record: mapRecord(db.prepare('SELECT * FROM fixed_expense_records WHERE id = ?').get(id)) });
});

router.put('/records/:id/pay', (req, res) => {
  if (!db.prepare('SELECT id FROM fixed_expense_records WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Registro no encontrado' });
  db.prepare('UPDATE fixed_expense_records SET paid=1, paid_date=? WHERE id=?')
    .run(new Date().toISOString().split('T')[0], req.params.id);
  res.json({ record: mapRecord(db.prepare('SELECT * FROM fixed_expense_records WHERE id = ?').get(req.params.id)) });
});

// Generate monthly records from active recurring types
router.post('/records/generate/:month', (req, res) => {
  const { month } = req.params;
  const types = db.prepare('SELECT * FROM fixed_expense_types WHERE active=1 AND recurring=1').all();
  const existingTypeIds = new Set(
    db.prepare('SELECT type_id FROM fixed_expense_records WHERE month=?').all(month).map((r) => r.type_id)
  );
  const insert = db.prepare('INSERT INTO fixed_expense_records (id,type_id,type_name,month,amount,due_date,paid,paid_date) VALUES (?,?,?,?,?,?,?,?)');
  const newRecords = [];
  const insertAll = db.transaction(() => {
    for (const t of types) {
      if (existingTypeIds.has(t.id)) continue;
      const id = randomUUID();
      const day = String(t.due_day).padStart(2, '0');
      insert.run(id, t.id, t.name, month, t.default_amount, `${month}-${day}`, 0, null);
      newRecords.push(mapRecord(db.prepare('SELECT * FROM fixed_expense_records WHERE id = ?').get(id)));
    }
  });
  insertAll();
  res.json({ records: newRecords });
});

export default router;
