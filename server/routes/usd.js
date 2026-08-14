import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id,
  type: r.type,                 // 'compra' | 'venta'
  amountUsd: r.amount_usd,
  rate: r.rate,                 // pesos por dólar
  amountPesos: r.amount_pesos,  // amount_usd * rate
  date: r.date,
  notes: r.notes ?? '',
  createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ usdOperations: db.prepare('SELECT * FROM usd_operations ORDER BY date ASC, created_at ASC').all().map(map) });
});

router.post('/', (req, res) => {
  const o = req.body;
  const id = randomUUID();
  const amountUsd = Number(o.amountUsd) || 0;
  const rate = Number(o.rate) || 0;
  // El total en pesos se calcula en el server para que sea consistente (usd × cotización).
  const amountPesos = o.amountPesos != null ? Number(o.amountPesos) : amountUsd * rate;
  db.prepare(`INSERT INTO usd_operations (id,type,amount_usd,rate,amount_pesos,date,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(id, o.type === 'venta' ? 'venta' : 'compra', amountUsd, rate, amountPesos,
      o.date ?? new Date().toISOString().split('T')[0], o.notes ?? '', new Date().toISOString());
  res.status(201).json({ usdOperation: map(db.prepare('SELECT * FROM usd_operations WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM usd_operations WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Operación no encontrada' });
  db.prepare('DELETE FROM usd_operations WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
