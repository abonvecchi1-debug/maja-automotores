import db from './db.js';

// Clave de Groq (IA) para leer hojas de crédito, capturas de avisos y opiniones de tasación.
// En la nube (Render) viene de la variable de entorno GROQ_API_KEY. En la app de escritorio
// se carga desde Sincronización y queda guardada solo en esta PC (sync_config no se sincroniza).
export function getGroqKey() {
  return (
    process.env.GROQ_API_KEY ||
    db.prepare("SELECT value FROM sync_config WHERE key = 'groq_api_key'").get()?.value ||
    ''
  ).trim();
}

export function groqKeySource() {
  if (process.env.GROQ_API_KEY) return 'env';
  return db.prepare("SELECT value FROM sync_config WHERE key = 'groq_api_key'").get()?.value ? 'local' : null;
}

export function setGroqKey(key) {
  const k = String(key ?? '').trim();
  if (k) db.prepare("INSERT OR REPLACE INTO sync_config (key, value) VALUES ('groq_api_key', ?)").run(k);
  else db.prepare("DELETE FROM sync_config WHERE key = 'groq_api_key'").run();
}
