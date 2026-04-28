import db, { SYNCABLE_TABLES } from './db.js';

const PING_INTERVAL_MS = 15_000;   // check connectivity every 15s
const AUTO_SYNC_INTERVAL_MS = 5 * 60_000; // background sync every 5 min

let state = {
  online: false,
  syncing: false,
  lastSync: null,
  error: null,
};

let intervalId = null;
let wasOnline = false;

/* ── Config helpers ─────────────────────────────────────────────────────── */

function getRenderUrl() {
  return (
    db.prepare("SELECT value FROM sync_config WHERE key = 'render_url'").get()?.value ||
    process.env.RENDER_URL ||
    ''
  ).replace(/\/+$/, '');
}

function getApiKey() {
  return (
    db.prepare("SELECT value FROM sync_config WHERE key = 'sync_key'").get()?.value ||
    process.env.SYNC_API_KEY ||
    ''
  );
}

function getLastSync() {
  return db.prepare("SELECT value FROM sync_config WHERE key = 'last_sync_at'").get()?.value || '2000-01-01T00:00:00Z';
}

function setLastSync(ts) {
  db.prepare("INSERT OR REPLACE INTO sync_config (key, value) VALUES ('last_sync_at', ?)").run(ts);
}

/* ── Connectivity ───────────────────────────────────────────────────────── */

async function checkOnline() {
  const url = getRenderUrl();
  if (!url) return false;
  try {
    const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Upsert helpers ─────────────────────────────────────────────────────── */

function upsertRecords(table, records) {
  if (!records?.length) return;
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    const setClauses = columns.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');
    const stmt = db.prepare(`
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${columns.map(c => `@${c}`).join(', ')})
      ON CONFLICT(id) DO UPDATE SET ${setClauses}
      WHERE excluded.updated_at > ${table}.updated_at OR ${table}.updated_at IS NULL
    `);
    const run = db.transaction(() => {
      for (const record of records) {
        const safe = {};
        for (const col of columns) safe[col] = record[col] ?? null;
        stmt.run(safe);
      }
    });
    run();
  } catch (err) {
    console.error(`[sync] upsert ${table}:`, err.message);
  }
}

/* ── Apply deletions received from remote ───────────────────────────────── */

function applyDeletions(deletions) {
  if (!deletions?.length) return;
  for (const { id, table_name, deleted_at } of deletions) {
    if (!SYNCABLE_TABLES.includes(table_name)) continue;
    try {
      db.prepare(`DELETE FROM ${table_name} WHERE id = ?`).run(id);
      // Overwrite the timestamp set by the DELETE trigger with the original one
      db.prepare(`INSERT OR REPLACE INTO sync_deletions (id, table_name, deleted_at) VALUES (?, ?, ?)`)
        .run(id, table_name, deleted_at);
    } catch (err) {
      console.error(`[sync] delete ${table_name}/${id}:`, err.message);
    }
  }
}

/* ── Pull from Render ───────────────────────────────────────────────────── */

async function pull(renderUrl, apiKey, since) {
  const res = await fetch(`${renderUrl}/api/sync/pull?since=${encodeURIComponent(since)}`, {
    headers: { 'X-Sync-Key': apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Pull HTTP ${res.status}`);
  const raw = await res.json();
  const { _deletions: deletions = [], ...records } = raw;
  return { records, deletions };
}

/* ── Push to Render ─────────────────────────────────────────────────────── */

async function push(renderUrl, apiKey, since) {
  const data = {};
  for (const table of SYNCABLE_TABLES) {
    try {
      const rows = db.prepare(`SELECT * FROM ${table} WHERE updated_at > ?`).all(since);
      if (rows.length) data[table] = rows;
    } catch {}
  }
  const deletions = db.prepare(`SELECT * FROM sync_deletions WHERE deleted_at > ?`).all(since);
  if (!Object.keys(data).length && !deletions.length) return;

  const res = await fetch(`${renderUrl}/api/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Key': apiKey },
    body: JSON.stringify({ data, deletions }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Push HTTP ${res.status}`);
}

/* ── Core sync ──────────────────────────────────────────────────────────── */

async function sync() {
  const renderUrl = getRenderUrl();
  const apiKey = getApiKey();
  if (!renderUrl || !apiKey) return;
  if (state.syncing) return;

  state.syncing = true;
  state.error = null;

  try {
    const since = getLastSync();
    const syncStart = new Date().toISOString();

    const { records: remoteData, deletions: remoteDeletions } = await pull(renderUrl, apiKey, since);
    for (const [table, records] of Object.entries(remoteData)) {
      upsertRecords(table, records);
    }
    applyDeletions(remoteDeletions);

    await push(renderUrl, apiKey, since);

    setLastSync(syncStart);
    state.lastSync = syncStart;
    console.log(`[sync] completed at ${syncStart}`);
  } catch (err) {
    state.error = err.message;
    console.error('[sync] error:', err.message);
  } finally {
    state.syncing = false;
  }
}

/* ── Public API ─────────────────────────────────────────────────────────── */

export function getStatus() {
  const renderUrl = getRenderUrl();
  const apiKey = getApiKey();
  return {
    ...state,
    renderUrl: renderUrl || null,
    configured: !!(renderUrl && apiKey),
  };
}

export async function triggerSync() {
  const isOnline = await checkOnline();
  if (!isOnline) {
    state.online = false;
    return { ok: false, reason: 'offline' };
  }
  state.online = true;
  await sync();
  return { ok: true };
}

export function start() {
  // Initial check
  checkOnline().then(online => {
    state.online = online;
    wasOnline = online;
    if (online) sync();
  });

  intervalId = setInterval(async () => {
    const online = await checkOnline();

    if (online && !wasOnline) {
      // Just came back online → sync immediately
      state.online = true;
      await sync();
    } else if (!online && wasOnline) {
      state.online = false;
    } else if (online) {
      state.online = true;
      const elapsed = state.lastSync
        ? Date.now() - new Date(state.lastSync).getTime()
        : Infinity;
      if (elapsed > AUTO_SYNC_INTERVAL_MS) await sync();
    }

    wasOnline = online;
  }, PING_INTERVAL_MS);
}

export function stop() {
  if (intervalId) clearInterval(intervalId);
}
