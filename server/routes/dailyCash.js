import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const mapCash = (r) => ({
  id: r.id, date: r.date, openingBalance: r.opening_balance,
  closingBalance: r.closing_balance ?? undefined, closed: r.closed === 1,
  notes: r.notes, createdAt: r.created_at,
});

const mapMovement = (r) => ({
  id: r.id, dailyCashId: r.daily_cash_id, type: r.type, amount: r.amount,
  description: r.description, category: r.category, createdAt: r.created_at,
});

router.get('/', (req, res) => {
  const dailyCashes = db.prepare('SELECT * FROM daily_cashes ORDER BY date DESC').all().map(mapCash);
  const cashMovements = db.prepare('SELECT * FROM cash_movements ORDER BY created_at ASC').all().map(mapMovement);
  res.json({ dailyCashes, cashMovements });
});

router.post('/open', (req, res) => {
  const { date, openingBalance } = req.body;
  const id = randomUUID();
  db.prepare('INSERT INTO daily_cashes (id,date,opening_balance,closed,notes,created_at) VALUES (?,?,?,?,?,?)')
    .run(id, date, openingBalance ?? 0, 0, '', new Date().toISOString());
  res.status(201).json({ dailyCash: mapCash(db.prepare('SELECT * FROM daily_cashes WHERE id = ?').get(id)) });
});

router.put('/:id/close', (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT id FROM daily_cashes WHERE id = ?').get(id)) return res.status(404).json({ error: 'Caja no encontrada' });
  const { closingBalance, notes } = req.body;
  db.prepare('UPDATE daily_cashes SET closed=1, closing_balance=?, notes=? WHERE id=?')
    .run(closingBalance, notes ?? '', id);
  res.json({ dailyCash: mapCash(db.prepare('SELECT * FROM daily_cashes WHERE id = ?').get(id)) });
});

router.post('/movements', (req, res) => {
  const m = req.body;
  const id = randomUUID();
  db.prepare('INSERT INTO cash_movements (id,daily_cash_id,type,amount,description,category,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, m.dailyCashId, m.type, m.amount, m.description, m.category ?? '', new Date().toISOString());
  res.status(201).json({ movement: mapMovement(db.prepare('SELECT * FROM cash_movements WHERE id = ?').get(id)) });
});

router.delete('/movements/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM cash_movements WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Movimiento no encontrado' });
  db.prepare('DELETE FROM cash_movements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
