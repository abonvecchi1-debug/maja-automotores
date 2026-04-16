import express from 'express';
import { randomUUID } from 'crypto';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const map = (r) => ({
  id: r.id, vehicleId: r.vehicle_id, clientId: r.client_id ?? undefined,
  gestorId: r.gestor_id ?? undefined, status: r.status,
  verificacionPolicial: r.verificacion_policial === 1,
  verificacionFecha: r.verificacion_fecha ?? undefined,
  informeDominio: r.informe_dominio === 1,
  informeDominioFecha: r.informe_dominio_fecha ?? undefined,
  formulario08Firmado: r.formulario_08_firmado === 1,
  tituloEntregado: r.titulo_entregado === 1,
  cedulaEntregada: r.cedula_entregada === 1,
  fechaEstimadaEntrega: r.fecha_estimada_entrega ?? undefined,
  fechaCompletado: r.fecha_completado ?? undefined,
  notes: r.notes, createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ transfers: db.prepare('SELECT * FROM transfers ORDER BY created_at DESC').all().map(map) });
});

router.post('/', (req, res) => {
  const t = req.body;
  const id = randomUUID();
  db.prepare(`INSERT INTO transfers (id,vehicle_id,client_id,gestor_id,status,verificacion_policial,verificacion_fecha,
    informe_dominio,informe_dominio_fecha,formulario_08_firmado,titulo_entregado,cedula_entregada,
    fecha_estimada_entrega,fecha_completado,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, t.vehicleId, t.clientId ?? null, t.gestorId ?? null, t.status ?? 'pendiente',
      t.verificacionPolicial ? 1 : 0, t.verificacionFecha ?? null,
      t.informeDominio ? 1 : 0, t.informeDominioFecha ?? null,
      t.formulario08Firmado ? 1 : 0, t.tituloEntregado ? 1 : 0, t.cedulaEntregada ? 1 : 0,
      t.fechaEstimadaEntrega ?? null, t.fechaCompletado ?? null, t.notes ?? '', new Date().toISOString());
  res.status(201).json({ transfer: map(db.prepare('SELECT * FROM transfers WHERE id = ?').get(id)) });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const ex = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
  if (!ex) return res.status(404).json({ error: 'Transferencia no encontrada' });
  const t = req.body;
  const b = (field, exField) => t[field] !== undefined ? (t[field] ? 1 : 0) : exField;
  const n = (field, exField) => t[field] !== undefined ? (t[field] ?? null) : exField;
  db.prepare(`UPDATE transfers SET vehicle_id=?,client_id=?,gestor_id=?,status=?,verificacion_policial=?,
    verificacion_fecha=?,informe_dominio=?,informe_dominio_fecha=?,formulario_08_firmado=?,
    titulo_entregado=?,cedula_entregada=?,fecha_estimada_entrega=?,fecha_completado=?,notes=? WHERE id=?`)
    .run(t.vehicleId ?? ex.vehicle_id, n('clientId', ex.client_id), n('gestorId', ex.gestor_id),
      t.status ?? ex.status, b('verificacionPolicial', ex.verificacion_policial),
      n('verificacionFecha', ex.verificacion_fecha), b('informeDominio', ex.informe_dominio),
      n('informeDominioFecha', ex.informe_dominio_fecha), b('formulario08Firmado', ex.formulario_08_firmado),
      b('tituloEntregado', ex.titulo_entregado), b('cedulaEntregada', ex.cedula_entregada),
      n('fechaEstimadaEntrega', ex.fecha_estimada_entrega), n('fechaCompletado', ex.fecha_completado),
      t.notes ?? ex.notes, id);
  res.json({ transfer: map(db.prepare('SELECT * FROM transfers WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM transfers WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Transferencia no encontrada' });
  db.prepare('DELETE FROM transfers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
