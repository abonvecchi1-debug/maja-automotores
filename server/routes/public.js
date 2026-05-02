import express from 'express';
import db from '../db.js';

const router = express.Router();

// CORS abierto para que la landing page pública pueda consumir estos endpoints
router.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Solo devuelve vehículos publicados (sin datos internos como precio de compra)
router.get('/vehicles', (req, res) => {
  const rows = db.prepare(`
    SELECT id, brand, model, year, km, color, publish_price, usd_price, images, notes
    FROM vehicles
    WHERE status = 'publicado'
    ORDER BY created_at DESC
  `).all();

  const vehicles = rows.map((r) => ({
    id: r.id,
    brand: r.brand,
    model: r.model,
    year: r.year,
    km: r.km,
    color: r.color,
    publishPrice: r.publish_price,
    usdPrice: r.usd_price ?? null,
    images: JSON.parse(r.images ?? '[]'),
    notes: r.notes,
  }));

  res.json({ vehicles, total: vehicles.length });
});
