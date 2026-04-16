import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id,
  brand: r.brand,
  model: r.model,
  year: r.year,
  km: r.km,
  color: r.color,
  patent: r.patent,
  status: r.status,
  purchasePrice: r.purchase_price,
  publishPrice: r.publish_price,
  soldPrice: r.sold_price ?? undefined,
  usdPrice: r.usd_price ?? undefined,
  purchaseDate: r.purchase_date,
  soldDate: r.sold_date ?? undefined,
  soldToClientId: r.sold_to_client_id ?? undefined,
  saleId: r.sale_id ?? undefined,
  tradeInVehicleId: r.trade_in_vehicle_id ?? undefined,
  checklist: JSON.parse(r.checklist),
  documents: JSON.parse(r.documents),
  images: JSON.parse(r.images),
  publishLinks: JSON.parse(r.publish_links),
  priceHistory: JSON.parse(r.price_history),
  notes: r.notes,
  createdAt: r.created_at,
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM vehicles ORDER BY created_at DESC').all();
  res.json({ vehicles: rows.map(map) });
});

router.post('/', (req, res) => {
  const v = req.body;
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO vehicles (id,brand,model,year,km,color,patent,status,purchase_price,publish_price,
      sold_price,usd_price,purchase_date,sold_date,sold_to_client_id,sale_id,trade_in_vehicle_id,
      checklist,documents,images,publish_links,price_history,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, v.brand, v.model, v.year, v.km, v.color, v.patent, v.status,
    v.purchasePrice, v.publishPrice,
    v.soldPrice ?? null, v.usdPrice ?? null,
    v.purchaseDate, v.soldDate ?? null, v.soldToClientId ?? null, v.saleId ?? null,
    v.tradeInVehicleId ?? null,
    JSON.stringify(v.checklist ?? { lavado: false, pulido: false, mecanica: false, papeles: false }),
    JSON.stringify(v.documents ?? { titulo: false, cedulaVerde: false, cedulaAzul: false, vtv: false, libreDeuda: false, verificacionPolicial: false, seguro: false }),
    JSON.stringify(v.images ?? []),
    JSON.stringify(v.publishLinks ?? []),
    JSON.stringify(v.priceHistory ?? []),
    v.notes ?? '', now
  );
  res.status(201).json({ vehicle: map(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const v = req.body;
  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Vehículo no encontrado' });
  db.prepare(`
    UPDATE vehicles SET brand=?,model=?,year=?,km=?,color=?,patent=?,status=?,
      purchase_price=?,publish_price=?,sold_price=?,usd_price=?,purchase_date=?,
      sold_date=?,sold_to_client_id=?,sale_id=?,trade_in_vehicle_id=?,
      checklist=?,documents=?,images=?,publish_links=?,price_history=?,notes=?
    WHERE id=?
  `).run(
    v.brand ?? existing.brand, v.model ?? existing.model, v.year ?? existing.year,
    v.km ?? existing.km, v.color ?? existing.color, v.patent ?? existing.patent,
    v.status ?? existing.status, v.purchasePrice ?? existing.purchase_price,
    v.publishPrice ?? existing.publish_price,
    v.soldPrice !== undefined ? v.soldPrice : existing.sold_price,
    v.usdPrice !== undefined ? v.usdPrice : existing.usd_price,
    v.purchaseDate ?? existing.purchase_date,
    v.soldDate !== undefined ? v.soldDate : existing.sold_date,
    v.soldToClientId !== undefined ? v.soldToClientId : existing.sold_to_client_id,
    v.saleId !== undefined ? v.saleId : existing.sale_id,
    v.tradeInVehicleId !== undefined ? v.tradeInVehicleId : existing.trade_in_vehicle_id,
    v.checklist ? JSON.stringify(v.checklist) : existing.checklist,
    v.documents ? JSON.stringify(v.documents) : existing.documents,
    v.images ? JSON.stringify(v.images) : existing.images,
    v.publishLinks ? JSON.stringify(v.publishLinks) : existing.publish_links,
    v.priceHistory ? JSON.stringify(v.priceHistory) : existing.price_history,
    v.notes !== undefined ? v.notes : existing.notes,
    id
  );
  res.json({ vehicle: map(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT id FROM vehicles WHERE id = ?').get(id)) return res.status(404).json({ error: 'Vehículo no encontrado' });
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
