import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id,
  description: r.description,
  value: r.value,
  purchaseDate: r.purchase_date,
  notes: r.notes ?? '',
  createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ capitalAssets: db.prepare('SELECT * FROM capital_assets ORDER BY purchase_date DESC, created_at DESC').all().map(map) });
});

router.post('/', (req, res) => {
  const a = req.body;
  const id = randomUUID();
  db.prepare(`INSERT INTO capital_assets (id,description,value,purchase_date,notes,created_at) VALUES (?,?,?,?,?,?)`)
    .run(id, a.description ?? '', Number(a.value) || 0, a.purchaseDate ?? new Date().toISOString().split('T')[0], a.notes ?? '', new Date().toISOString());
  res.status(201).json({ capitalAsset: map(db.prepare('SELECT * FROM capital_assets WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM capital_assets WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Bien no encontrado' });
  db.prepare('DELETE FROM capital_assets WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
