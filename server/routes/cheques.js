import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id,
  numero: r.numero,
  banco: r.banco,
  monto: r.monto,
  moneda: r.moneda,
  fechaEmision: r.fecha_emision,
  fechaVencimiento: r.fecha_vencimiento,
  tipo: r.tipo,
  alPortador: r.al_portador === 1,
  endosado: r.endosado === 1,
  librador: r.librador,
  cuitLibrador: r.cuit_librador,
  recibidoDe: r.recibido_de,
  entregadoA: r.entregado_a,
  estado: r.estado,
  observaciones: r.observaciones,
  createdAt: r.created_at,
});

router.get('/', (req, res) => {
  const { estado, tipo, from, to } = req.query;
  let q = 'SELECT * FROM cheques WHERE 1=1';
  const params = [];
  if (estado) { q += ' AND estado = ?'; params.push(estado); }
  if (tipo) { q += ' AND tipo = ?'; params.push(tipo); }
  if (from) { q += ' AND fecha_vencimiento >= ?'; params.push(from); }
  if (to) { q += ' AND fecha_vencimiento <= ?'; params.push(to); }
  q += ' ORDER BY fecha_vencimiento ASC';
  res.json({ cheques: db.prepare(q).all(...params).map(map) });
});

router.post('/', (req, res) => {
  const b = req.body;
  const id = randomUUID();
  db.prepare(`INSERT INTO cheques
    (id,numero,banco,monto,moneda,fecha_emision,fecha_vencimiento,tipo,al_portador,endosado,
     librador,cuit_librador,recibido_de,entregado_a,estado,observaciones,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      id, b.numero ?? '', b.banco ?? '', b.monto ?? 0, b.moneda ?? 'ARS',
      b.fechaEmision ?? '', b.fechaVencimiento ?? '',
      b.tipo ?? 'al_dia', b.alPortador ? 1 : 0, b.endosado ? 1 : 0,
      b.librador ?? '', b.cuitLibrador ?? '', b.recibidoDe ?? '',
      b.entregadoA ?? '', b.estado ?? 'en_cartera', b.observaciones ?? '',
      new Date().toISOString(),
    );
  res.status(201).json({ cheque: map(db.prepare('SELECT * FROM cheques WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM cheques WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Cheque no encontrado' });
  const b = req.body;
  db.prepare(`UPDATE cheques SET
    numero=?,banco=?,monto=?,moneda=?,fecha_emision=?,fecha_vencimiento=?,tipo=?,
    al_portador=?,endosado=?,librador=?,cuit_librador=?,recibido_de=?,entregado_a=?,
    estado=?,observaciones=?
    WHERE id=?`)
    .run(
      b.numero ?? ex.numero, b.banco ?? ex.banco,
      b.monto !== undefined ? b.monto : ex.monto,
      b.moneda ?? ex.moneda,
      b.fechaEmision !== undefined ? b.fechaEmision : ex.fecha_emision,
      b.fechaVencimiento !== undefined ? b.fechaVencimiento : ex.fecha_vencimiento,
      b.tipo ?? ex.tipo,
      b.alPortador !== undefined ? (b.alPortador ? 1 : 0) : ex.al_portador,
      b.endosado !== undefined ? (b.endosado ? 1 : 0) : ex.endosado,
      b.librador !== undefined ? b.librador : ex.librador,
      b.cuitLibrador !== undefined ? b.cuitLibrador : ex.cuit_librador,
      b.recibidoDe !== undefined ? b.recibidoDe : ex.recibido_de,
      b.entregadoA !== undefined ? b.entregadoA : ex.entregado_a,
      b.estado ?? ex.estado,
      b.observaciones !== undefined ? b.observaciones : ex.observaciones,
      id,
    );
  res.json({ cheque: map(db.prepare('SELECT * FROM cheques WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM cheques WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Cheque no encontrado' });
  db.prepare('DELETE FROM cheques WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
