import express from 'express';
import db, { SYNCABLE_TABLES } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getStatus, triggerSync, forceFullSync } from '../sync-service.js';
import { applyPushRecords } from '../sync-apply.js';

const router = express.Router();

/* ── Auth for machine-to-machine sync calls ─────────────────────────────── */
function syncKeyAuth(req, res, next) {
  const key = req.headers['x-sync-key'];
  const expected = process.env.SYNC_API_KEY;
  if (!expected || !key || key !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

/* ── Status (frontend polls this) ───────────────────────────────────────── */
router.get('/status', authenticateToken, (req, res) => {
  res.json(getStatus());
});

/* ── Config (read + write Render URL) ───────────────────────────────────── */
router.get('/config', authenticateToken, requireAdmin, (req, res) => {
  const renderUrl = db.prepare("SELECT value FROM sync_config WHERE key = 'render_url'").get()?.value || '';
  const lastSync  = db.prepare("SELECT value FROM sync_config WHERE key = 'last_sync_at'").get()?.value || null;
  const syncKey   = db.prepare("SELECT value FROM sync_config WHERE key = 'sync_key'").get()?.value || '';
  res.json({ renderUrl, lastSync, syncKey });
});

router.put('/config', authenticateToken, requireAdmin, (req, res) => {
  const { renderUrl, syncKey } = req.body;
  if (typeof renderUrl !== 'string') return res.status(400).json({ error: 'renderUrl required' });
  db.prepare("INSERT OR REPLACE INTO sync_config (key, value) VALUES ('render_url', ?)")
    .run(renderUrl.trim().replace(/\/+$/, ''));
  if (typeof syncKey === 'string' && syncKey.trim()) {
    db.prepare("INSERT OR REPLACE INTO sync_config (key, value) VALUES ('sync_key', ?)").run(syncKey.trim());
  }
  res.json({ ok: true });
});

/* ── Manual sync trigger ─────────────────────────────────────────────────── */
router.post('/now', authenticateToken, requireAdmin, async (req, res) => {
  const result = await triggerSync();
  res.json(result);
});

/* ── Full re-sync: reset watermark and pull everything again ─────────────── */
router.post('/full', authenticateToken, requireAdmin, async (req, res) => {
  const result = await forceFullSync();
  res.json(result);
});

/* ── Pull: return records + deletions ───────────────────────────────────
 * Cliente NUEVO: manda `cursor` (marca del servidor). Filtramos por
 *   server_updated_at > cursor y devolvemos `_cursor` = ahora (con 2s de margen
 *   para no perder filas por el borde). El cursor es siempre reloj del servidor,
 *   así que no depende del reloj de cada PC.
 * Cliente VIEJO: manda solo `since` → comportamiento anterior por updated_at. */
router.get('/pull', syncKeyAuth, (req, res) => {
  const hasCursor = req.query.cursor !== undefined;
  const result = {};

  if (hasCursor) {
    // Marca capturada ANTES de leer. El cursor devuelto lleva un margen hacia atrás
    // (SAFETY_MS) para NO perder una fila que se selle en el mismo milisegundo del
    // corte: el filtro es estricto (`>`), así que sin margen una fila con
    // server_updated_at == cursor quedaría afuera para siempre. El margen re-baja
    // unos pocos segundos de solape (idempotente) a cambio de no saltear nunca.
    const SAFETY_MS = 3000;
    const serverNow = Date.now();
    const cursor = req.query.cursor || '2000-01-01T00:00:00Z';
    for (const table of SYNCABLE_TABLES) {
      try {
        result[table] = db.prepare(`SELECT * FROM ${table} WHERE server_updated_at > ?`).all(cursor);
      } catch {
        result[table] = [];
      }
    }
    result._deletions = db.prepare(`SELECT * FROM sync_deletions WHERE server_deleted_at > ?`).all(cursor);
    result._cursor = new Date(serverNow - SAFETY_MS).toISOString();
    result._serverTime = new Date(serverNow).toISOString(); // para detectar reloj desfasado en el cliente
  } else {
    const since = req.query.since || '2000-01-01T00:00:00Z';
    for (const table of SYNCABLE_TABLES) {
      try {
        result[table] = db.prepare(`SELECT * FROM ${table} WHERE updated_at > ?`).all(since);
      } catch {
        result[table] = [];
      }
    }
    result._deletions = db.prepare(`SELECT * FROM sync_deletions WHERE deleted_at > ?`).all(since);
  }

  res.json(result);
});

/* ── Push: receive records + deletions from another device ────────────── */
router.post('/push', syncKeyAuth, (req, res) => {
  const { data, deletions } = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'No data' });

  // Reloj del servidor: sella cada fila que realmente entra/cambia. Los clientes
  // piden contra esta marca, así ninguno se queda atrás por tener el reloj corrido.
  const serverNow = new Date().toISOString();
  const results = {};

  // Upsert records — resolución de conflictos por `rev` (ver sync-apply.js).
  for (const [table, records] of Object.entries(data)) {
    if (!SYNCABLE_TABLES.includes(table) || !Array.isArray(records)) continue;
    try {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      const run = db.transaction(() => applyPushRecords(db, table, columns, records, serverNow));
      results[table] = run();
    } catch (err) {
      results[table] = `error: ${err.message}`;
    }
  }

  // Apply deletions
  if (Array.isArray(deletions)) {
    const hasDelCol = db.prepare(`PRAGMA table_info(sync_deletions)`).all().map(c => c.name).includes('server_deleted_at');
    let deleted = 0;
    for (const { id, table_name, deleted_at } of deletions) {
      if (!SYNCABLE_TABLES.includes(table_name)) continue;
      try {
        db.prepare(`DELETE FROM ${table_name} WHERE id = ?`).run(id);
        if (hasDelCol) {
          db.prepare(`INSERT OR REPLACE INTO sync_deletions (id, table_name, deleted_at, server_deleted_at) VALUES (?, ?, ?, ?)`)
            .run(id, table_name, deleted_at, serverNow);
        } else {
          db.prepare(`INSERT OR REPLACE INTO sync_deletions (id, table_name, deleted_at) VALUES (?, ?, ?)`)
            .run(id, table_name, deleted_at);
        }
        deleted++;
      } catch {}
    }
    results._deletions = deleted;
  }

  res.json({ results });
});

export default router;
