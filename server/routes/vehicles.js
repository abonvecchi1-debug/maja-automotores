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
  senaAmount: r.sena_amount ?? undefined,
  senaDate: r.sena_date ?? undefined,
  senaType: r.sena_type ?? undefined,
  senaClientId: r.sena_client_id ?? undefined,
  senaMethod: r.sena_method ?? undefined,
  acquiredAs: r.acquired_as ?? undefined,
  tradeInFromClientId: r.trade_in_from_client_id ?? undefined,
  tradeInSourceVehicleId: r.trade_in_source_vehicle_id ?? undefined,
  purchaseSupplierId: r.purchase_supplier_id ?? undefined,
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
      sena_amount,sena_date,sena_type,sena_client_id,sena_method,
      acquired_as,trade_in_from_client_id,trade_in_source_vehicle_id,purchase_supplier_id,
      checklist,documents,images,publish_links,price_history,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, v.brand, v.model, v.year, v.km, v.color, v.patent, v.status,
    v.purchasePrice, v.publishPrice,
    v.soldPrice ?? null, v.usdPrice ?? null,
    v.purchaseDate, v.soldDate ?? null, v.soldToClientId ?? null, v.saleId ?? null,
    v.tradeInVehicleId ?? null,
    v.senaAmount ?? null, v.senaDate ?? null, v.senaType ?? null, v.senaClientId ?? null, v.senaMethod ?? null,
    v.acquiredAs ?? null, v.tradeInFromClientId ?? null, v.tradeInSourceVehicleId ?? null, v.purchaseSupplierId ?? null,
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
      sena_amount=?,sena_date=?,sena_type=?,sena_client_id=?,sena_method=?,
      acquired_as=?,trade_in_from_client_id=?,trade_in_source_vehicle_id=?,purchase_supplier_id=?,
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
    v.senaAmount !== undefined ? v.senaAmount : existing.sena_amount,
    v.senaDate !== undefined ? v.senaDate : existing.sena_date,
    v.senaType !== undefined ? v.senaType : existing.sena_type,
    v.senaClientId !== undefined ? v.senaClientId : existing.sena_client_id,
    v.senaMethod !== undefined ? v.senaMethod : existing.sena_method,
    v.acquiredAs !== undefined ? v.acquiredAs : existing.acquired_as,
    v.tradeInFromClientId !== undefined ? v.tradeInFromClientId : existing.trade_in_from_client_id,
    v.tradeInSourceVehicleId !== undefined ? v.tradeInSourceVehicleId : existing.trade_in_source_vehicle_id,
    v.purchaseSupplierId !== undefined ? v.purchaseSupplierId : existing.purchase_supplier_id,
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

// Crea un vehículo recibido en parte de pago. Devuelve su id.
export function createTradeInVehicle(tradeIn, { clientId, sourceVehicleId, date }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`INSERT INTO vehicles
    (id,brand,model,year,km,color,patent,status,purchase_price,publish_price,purchase_date,
     acquired_as,trade_in_from_client_id,trade_in_source_vehicle_id,
     checklist,documents,images,publish_links,price_history,notes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, tradeIn.brand ?? '', tradeIn.model ?? '', tradeIn.year ?? 0, tradeIn.km ?? 0,
    tradeIn.color ?? '', tradeIn.patent ?? '', 'comprado',
    tradeIn.value ?? 0, tradeIn.publishPrice ?? tradeIn.value ?? 0,
    date ?? now.split('T')[0], 'parte_pago', clientId ?? null, sourceVehicleId ?? null,
    JSON.stringify({ lavado: false, pulido: false, mecanica: false, papeles: false }),
    JSON.stringify({ titulo: false, cedulaVerde: false, cedulaAzul: false, vtv: false, libreDeuda: false, verificacionPolicial: false, seguro: false }),
    '[]', '[]', '[]', tradeIn.notes ?? '', now,
  );
  return id;
}

// Marca el vehículo como vendido. Soporta auto en parte de pago (nuevo o existente).
router.put('/:id/sell', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Vehículo no encontrado' });
  const { soldPrice, soldDate, clientId, tradeIn } = req.body;

  let tradeInVehicleId = null;
  let tradeInVehicleRow = null;
  const run = db.transaction(() => {
    if (tradeIn && tradeIn.type === 'new') {
      tradeInVehicleId = createTradeInVehicle(tradeIn, { clientId, sourceVehicleId: id, date: soldDate });
    } else if (tradeIn && tradeIn.type === 'existing' && tradeIn.vehicleId) {
      tradeInVehicleId = tradeIn.vehicleId;
      db.prepare(`UPDATE vehicles SET acquired_as='parte_pago', trade_in_from_client_id=?, trade_in_source_vehicle_id=? WHERE id=?`)
        .run(clientId ?? null, id, tradeIn.vehicleId);
    }
    db.prepare(`UPDATE vehicles SET status='vendido', sold_price=?, sold_date=?, sold_to_client_id=?, trade_in_vehicle_id=? WHERE id=?`)
      .run(soldPrice ?? 0, soldDate ?? null, clientId ?? null, tradeInVehicleId, id);
    if (tradeInVehicleId) tradeInVehicleRow = map(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(tradeInVehicleId));
  });
  run();
  res.json({ vehicle: map(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)), tradeInVehicle: tradeInVehicleRow });
});

// Revierte una venta: el vehículo vuelve a "publicado" y se borra la venta asociada
// (cuotas y cheques de esa venta). El auto recibido en parte de pago queda en stock.
router.put('/:id/revert-sale', (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Vehículo no encontrado' });
  const saleId = existing.sale_id;
  const run = db.transaction(() => {
    if (saleId) {
      db.prepare('DELETE FROM installment_payments WHERE sale_id = ?').run(saleId);
      // Solo se borran los cheques que siguen en cartera. Los ya cobrados/entregados/etc.
      // se conservan (se desvinculan de la venta) para no perder ese registro financiero.
      db.prepare(`DELETE FROM cheques WHERE sale_id = ? AND estado = 'en_cartera'`).run(saleId);
      db.prepare('UPDATE cheques SET sale_id = NULL WHERE sale_id = ?').run(saleId);
      db.prepare('DELETE FROM sales WHERE id = ?').run(saleId);
    }
    db.prepare(`UPDATE vehicles SET status='publicado', sold_price=NULL, sold_date=NULL,
      sold_to_client_id=NULL, sale_id=NULL, trade_in_vehicle_id=NULL WHERE id=?`).run(id);
  });
  run();
  res.json({ vehicle: map(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id)), deletedSaleId: saleId ?? null });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT id FROM vehicles WHERE id = ?').get(id)) return res.status(404).json({ error: 'Vehículo no encontrado' });
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default router;
