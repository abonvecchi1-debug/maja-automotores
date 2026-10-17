import express from 'express';
import { randomUUID } from 'crypto';
import multer from 'multer';
import Groq from 'groq-sdk';
import db from '../db.js';
import { getGroqKey } from '../ai-key.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

// Tasaciones: cotizar un auto usado a partir de avisos comparables (precio de
// publicación, toma máxima y ganancia). El cálculo vive en el front
// (pages/Appraisals.tsx); acá se guardan las tasaciones y se leen avisos pegados.
const router = express.Router();
router.use(authenticateToken, requireAdmin);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 4 } });
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

const parseJson = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
const map = (r) => ({
  id: r.id,
  title: r.title,
  form: parseJson(r.form, {}),
  comps: parseJson(r.comps, []),
  results: parseJson(r.results, {}),
  createdBy: r.created_by ?? '',
  createdAt: r.created_at,
});

router.get('/', (req, res) => {
  res.json({ appraisals: db.prepare('SELECT * FROM appraisals ORDER BY created_at DESC').all().map(map) });
});

router.post('/', (req, res) => {
  const a = req.body ?? {};
  const id = randomUUID();
  db.prepare(`INSERT INTO appraisals (id,title,form,comps,results,created_by,created_at) VALUES (?,?,?,?,?,?,?)`).run(
    id,
    String(a.title ?? '').slice(0, 200),
    JSON.stringify(a.form ?? {}),
    JSON.stringify(Array.isArray(a.comps) ? a.comps : []),
    JSON.stringify(a.results ?? {}),
    req.user?.name ?? '',
    new Date().toISOString(),
  );
  res.status(201).json({ appraisal: map(db.prepare('SELECT * FROM appraisals WHERE id = ?').get(id)) });
});

router.delete('/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM appraisals WHERE id = ?').get(req.params.id)) return res.status(404).json({ error: 'Tasación no encontrada' });
  db.prepare('DELETE FROM appraisals WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── Lectura de avisos pegados ────────────────────────────────────────────────

const digits = (s) => Number(String(s ?? '').replace(/[^\d]/g, '')) || 0;

/**
 * Lector sin IA para el texto copiado de una página de resultados (MercadoLibre,
 * Marketplace, deRuedas, Autocosmos). Busca cada precio y arma el aviso con las
 * líneas de alrededor: título antes, año/km y lugar cerca.
 */
export function parseListingsText(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const prices = []; // { idx, moneda, precio }
  const reFull = /^(US\$|U\$S|USD|U\$D|\$)\s*([\d.]{3,}(?:,\d+)?)$/i;
  const reCur = /^(US\$|U\$S|USD|U\$D|\$)$/i;
  for (let i = 0; i < lines.length; i++) {
    let m = lines[i].match(reFull);
    let cur, amount, idx = i;
    if (m) { cur = m[1]; amount = m[2]; }
    else if (reCur.test(lines[i]) && i + 1 < lines.length && /^[\d.]{3,}(,\d+)?$/.test(lines[i + 1])) { cur = lines[i]; amount = lines[i + 1]; i++; }
    else continue;
    const moneda = cur === '$' ? 'ARS' : 'USD';
    const precio = digits(String(amount).split(',')[0]);
    const okArs = moneda === 'ARS' && precio >= 500_000 && precio <= 2_000_000_000;
    const okUsd = moneda === 'USD' && precio >= 500 && precio <= 1_000_000;
    if (okArs || okUsd) prices.push({ idx, end: i, moneda, precio });
  }
  const reYear = /\b(19[89]\d|20[0-3]\d)\b/;
  const reKm = /([\d.]+)\s*(km|kms|kilómetros|kilometros)\b/i;
  const reMilKm = /(\d+(?:[.,]\d+)?)\s*mil\s*(km|kms|kilómetros)/i;
  const noise = /cuota|envío|envio|financ|oferta|destacado|publicidad|ver más|mostrar|resultados|ordenar|filtrar|^\d+$|^\$|^US\$/i;
  const isKm = (l) => reKm.test(l) || reMilKm.test(l);
  const isTitle = (l) => /[a-záéíóúñ]{3,}/i.test(l) && l.length >= 6 && !noise.test(l) && !isKm(l);
  // 1) Título de cada precio. MercadoLibre lo pone justo ANTES del precio; Marketplace,
  //    justo DESPUÉS. Se mira la línea anterior (o dos, si la anterior es ruido) y, si no
  //    hay título ahí, la siguiente.
  const titleIdx = prices.map((p, k) => {
    const prevEnd = k > 0 ? prices[k - 1].end : -1;
    for (let j = p.idx - 1; j > prevEnd && j >= p.idx - 2; j--) {
      if (isTitle(lines[j])) return j;
      if (!noise.test(lines[j])) break;
    }
    const nextIdx = k + 1 < prices.length ? prices[k + 1].idx : lines.length;
    for (let j = p.end + 1; j < nextIdx && j <= p.end + 2; j++) if (isTitle(lines[j])) return j;
    return -1;
  });
  const taken = new Set(titleIdx.filter((i) => i >= 0));
  // 2) Año, km y lugar: en las líneas después del precio, hasta el próximo precio,
  //    sin pisar el título del aviso siguiente.
  const out = [];
  prices.forEach((p, k) => {
    if (titleIdx[k] < 0) return;
    const titulo = lines[titleIdx[k]];
    const nextIdx = k + 1 < prices.length ? prices[k + 1].idx : Math.min(lines.length, p.end + 7);
    let anio = 0, km = 0, ubicacion = '';
    for (let j = p.end + 1; j < nextIdx; j++) {
      if (taken.has(j) && j !== titleIdx[k]) break; // empieza el aviso siguiente
      const l = lines[j];
      if (!km && isKm(l)) {
        const mk = l.match(reMilKm);
        km = mk ? Math.round(parseFloat(mk[1].replace(',', '.')) * 1000) : digits(l.match(reKm)[1]);
        const my = l.match(reYear); if (my && !anio) anio = Number(my[1]);
        continue;
      }
      if (!ubicacion && j !== titleIdx[k] && /[a-záéíóúñ]{3,}/i.test(l) && !/\d{3,}/.test(l) && l.length <= 60 && !noise.test(l)) ubicacion = l;
    }
    if (!anio) { const my = titulo.match(reYear); if (my) anio = Number(my[1]); }
    out.push({ titulo: titulo.slice(0, 120), anio, km, precio: p.precio, moneda: p.moneda, ubicacion });
  });
  return out;
}

const vehLine = (f = {}) => [f.marca, f.modelo, f.version, f.anio, f.km ? `${Number(f.km).toLocaleString('es-AR')} km` : '', f.combustible, f.traccion].filter(Boolean).join(' · ');

function extractJsonArray(text) {
  const t = String(text || '').trim();
  try { const v = JSON.parse(t); if (Array.isArray(v)) return v; if (Array.isArray(v?.avisos)) return v.avisos; } catch {}
  const m = t.match(/\[[\s\S]*\]/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

router.post('/extract', upload.array('images', 4), async (req, res) => {
  const text = String(req.body?.text ?? '').slice(0, 60_000);
  const target = parseJson(req.body?.target ?? '{}', {});
  const files = req.files ?? [];
  if (!text.trim() && !files.length) return res.status(400).json({ error: 'Pegá el texto de los avisos o subí una captura.' });

  const key = getGroqKey();
  if (!key) {
    if (files.length && !text.trim()) return res.status(501).json({ error: 'Para leer capturas falta la clave de IA (Groq): cargala en Sincronización. Mientras, pegá el texto de la página.' });
    return res.json({ listings: parseListingsText(text), method: 'texto' });
  }

  const prompt = `Sos asistente de una agencia de autos usados en Argentina. Te paso ${[text.trim() ? 'texto copiado' : '', files.length ? 'capturas de pantalla' : ''].filter(Boolean).join(' y ')} de una búsqueda en un portal de autos (MercadoLibre, Facebook Marketplace, deRuedas, Autocosmos u otro).
Auto que estoy cotizando: ${vehLine(target) || 'sin datos'}.
Extraé cada aviso de vehículo que tenga precio. Respondé SOLO con un array JSON, sin texto extra, de objetos:
{"titulo": string, "anio": number, "km": number, "precio": number, "moneda": "ARS" | "USD", "ubicacion": string, "coincide": boolean}
Reglas: precio y km enteros sin puntos (ej. 16500000). US$, U$S o USD => "USD"; $ => "ARS". Si falta km o año, 0. "coincide" es true solo si es el mismo modelo y una versión equivalente (misma motorización y, si se ve, misma tracción y cabina). No inventes avisos ni datos.${text.trim() ? `\n\nTEXTO PEGADO:\n${text}` : ''}`;

  try {
    const groq = new Groq({ apiKey: key });
    const content = [
      ...files.map((f) => ({ type: 'image_url', image_url: { url: `data:${f.mimetype};base64,${f.buffer.toString('base64')}` } })),
      { type: 'text', text: prompt },
    ];
    const completion = await groq.chat.completions.create({ model: GROQ_MODEL, messages: [{ role: 'user', content }], max_tokens: 4096, temperature: 0 });
    const arr = extractJsonArray(completion.choices[0]?.message?.content);
    if (!arr) {
      if (text.trim()) return res.json({ listings: parseListingsText(text), method: 'texto' });
      return res.status(502).json({ error: 'La IA no devolvió una lista legible. Probá con otra captura.' });
    }
    const listings = arr.map((x) => ({
      titulo: String(x.titulo ?? '').slice(0, 120), anio: digits(x.anio), km: digits(x.km), precio: digits(x.precio),
      moneda: String(x.moneda).toUpperCase() === 'USD' ? 'USD' : 'ARS', ubicacion: String(x.ubicacion ?? '').slice(0, 80),
      coincide: x.coincide !== false,
    })).filter((x) => x.precio > 0);
    res.json({ listings, method: 'ia' });
  } catch (err) {
    console.error('Error en /api/appraisals/extract:', err);
    if (text.trim()) return res.json({ listings: parseListingsText(text), method: 'texto' });
    res.status(502).json({ error: 'No se pudo leer la captura con la IA. Probá de nuevo.' });
  }
});

router.post('/opinion', async (req, res) => {
  const key = getGroqKey();
  if (!key) return res.status(501).json({ error: 'Falta la clave de IA (Groq). Cargala en Sincronización.' });
  const { form = {}, comps = [], results = {} } = req.body ?? {};
  const fmt = (n) => '$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
  const compsTxt = comps.slice(0, 40).map((c) => `- ${c.titulo} | ${c.anio || '?'} | ${c.km ? Number(c.km).toLocaleString('es-AR') + ' km' : 'km ?'} | ${c.moneda === 'USD' ? 'US$ ' + Number(c.precio).toLocaleString('es-AR') : fmt(c.precio)} | ${c.ubicacion || ''}`).join('\n');
  const prompt = `Sos tasador de autos usados para una agencia chica en Argentina. Respondé en español rioplatense, directo y breve (máximo 220 palabras), sin markdown, en tres partes numeradas:
1. Si el precio de publicación y la toma máxima te parecen razonables según estos avisos, y por qué.
2. Qué revisar específicamente en este modelo, motor y año antes de tomarlo (fallas conocidas, puntos caros de arreglar).
3. Un argumento concreto para negociar la toma a la baja.
No inventes precios de mercado que no estén en los datos.

Auto: ${vehLine(form)}. Estado: ${form.estado || 'sin dato'}. Notas: ${form.notas || 'sin notas'}.
Avisos usados:
${compsTxt || '(ninguno)'}
Cálculo: publicación ${fmt(results.publicacion)}, cierre esperado ${fmt(results.cierre)}, costos ${fmt(results.costos)}, toma máxima ${fmt(results.tomaMax)}, primera oferta ${fmt(results.primeraOferta)}, ganancia ${fmt(results.ganancia)}.`;
  try {
    const groq = new Groq({ apiKey: key });
    const completion = await groq.chat.completions.create({ model: GROQ_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 900, temperature: 0.3 });
    res.json({ text: completion.choices[0]?.message?.content?.trim() || '' });
  } catch (err) {
    console.error('Error en /api/appraisals/opinion:', err);
    res.status(502).json({ error: 'No se pudo consultar a la IA. Probá de nuevo.' });
  }
});

export default router;
