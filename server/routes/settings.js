import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const DEFAULTS = {
  iibbRate: 3, province: 'Buenos Aires', businessName: 'Maja Automotores',
  cuit: '', currency: 'ARS',
};

const getAll = () => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = { ...DEFAULTS };
  for (const { key, value } of rows) {
    try { result[key] = JSON.parse(value); } catch { result[key] = value; }
  }
  return result;
};

router.get('/', (req, res) => {
  res.json({ settings: getAll() });
});

router.put('/', (req, res) => {
  const upsert = db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const update = db.transaction(() => {
    for (const [key, value] of Object.entries(req.body)) {
      upsert.run(key, JSON.stringify(value));
    }
  });
  update();
  res.json({ settings: getAll() });
});

export default router;
