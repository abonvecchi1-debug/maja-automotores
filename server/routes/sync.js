import express from 'express';
import db, { SYNCABLE_TABLES } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { getStatus, triggerSync } from '../sync-service.js';

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

/* ── Pull: return records + deletions since `since` ────────────────────── */
router.get('/pull', syncKeyAuth, (req, res) => {
  const since = req.query.since || '2000-01-01T00:00:00Z';
  const result = {};
  for (const table of SYNCABLE_TABLES) {
    try {
      result[table] = db.prepare(`SELECT * FROM ${table} WHERE updated_at > ?`).all(since);
    } catch {
      result[table] = [];
    }
  }
  result._deletions = db.prepare(`SELECT * FROM sync_deletions WHERE deleted_at > ?`).all(since);
  res.json(result);
});

/* ── Push: receive records + deletions from another device ────────────── */
router.post('/push', syncKeyAuth, (req, res) => {
  const { data, deletions } = req.body;
  if (!data || typeof data !== 'object') return res.status(400).json({ error: 'No data' });

  const results = {};

  // Upsert records
  for (const [table, records] of Object.entries(data)) {
    if (!SYNCABLE_TABLES.includes(table) || !Array.isArray(records)) continue;
    try {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      const setClauses = columns.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
      const stmt = db.prepare(`
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES (${columns.map(c => `@${c}`).join(', ')})
        ON CONFLICT(id) DO UPDATE SET ${setClauses}
        WHERE excluded.updated_at > ${table}.updated_at OR ${table}.updated_at IS NULL
      `);
      let count = 0;
      const run = db.transaction(() => {
        for (const record of records) {
          const safe = {};
          for (const col of columns) safe[col] = record[col] ?? null;
          stmt.run(safe);
          count++;
        }
      });
      run();
      results[table] = count;
    } catch (err) {
      results[table] = `error: ${err.message}`;
    }
  }

  // Apply deletions
  if (Array.isArray(deletions)) {
    let deleted = 0;
    for (const { id, table_name, deleted_at } of deletions) {
      if (!SYNCABLE_TABLES.includes(table_name)) continue;
      try {
        db.prepare(`DELETE FROM ${table_name} WHERE id = ?`).run(id);
        db.prepare(`INSERT OR REPLACE INTO sync_deletions (id, table_name, deleted_at) VALUES (?, ?, ?)`)
          .run(id, table_name, deleted_at);
        deleted++;
      } catch {}
    }
    results._deletions = deleted;
  }

  res.json({ results });
});

export default router;
