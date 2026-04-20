import express from 'express';
import Groq from 'groq-sdk';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import db from '../db.js';
import { randomUUID } from 'crypto';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PROMPT = `Sos un experto en financiamiento automotor argentino. Analizá esta hoja de campaña de créditos y devolvé un JSON con este formato exacto:
{
  "titulo": "nombre de la campaña",
  "emisor": "empresa/banco",
  "vigencia": { "desde": "...", "hasta": "..." },
  "modelo": "modelo de vehículo",
  "planes": [
    {
      "nombre": "nombre del plan",
      "plazo_meses": número,
      "tna": número (porcentaje),
      "quebranto": número (porcentaje),
      "maximo_capital": número (en pesos, sin puntos ni $),
      "cuota_por_mil": número (cuota cada $1000 financiados),
      "observaciones": "texto opcional"
    }
  ],
  "condiciones_generales": ["condición 1", "condición 2"],
  "seguro": "tipo de seguro si aplica",
  "identificacion_sistema": ["código 1", "código 2"],
  "notas": "aclaraciones importantes del documento",
  "explicacion": "Explicación completa en lenguaje simple para alguien que no conoce el sistema financiero. Explicá: qué es esta campaña y para qué sirve, qué significa TNA (Tasa Nominal Anual) y cómo impacta, qué es el quebranto y por qué existe, qué significa 'cuota por cada $1.000 financiados' con un ejemplo concreto (ej: si financiás $10.000.000 y la cuota es $83.33, pagás $83.33 x 10.000 = $833.300 por mes), qué es el máximo capital financiado, cómo se comparan los planes entre sí (cuál conviene según el caso), y cualquier condición importante a tener en cuenta. Usá ejemplos con números reales de la campaña. Escribí en párrafos, no en listas."
}
Devolvé SOLO el JSON, sin texto extra ni markdown ni bloques de código.`;

// Analyze image and auto-save
router.post('/analyze', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY no configurada' });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: PROMPT },
      ]}],
      max_tokens: 4096,
    });

    const text = completion.choices[0].message.content.trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      try { parsed = match ? JSON.parse(match[0]) : { raw: text }; }
      catch { parsed = { raw: text }; }
    }

    // Auto-save to DB
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO credit_campaigns (id, titulo, emisor, modelo, vigencia_desde, vigencia_hasta, planes, condiciones_generales, seguro, identificacion_sistema, notas, explicacion, raw_result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id,
      parsed.titulo || '',
      parsed.emisor || '',
      parsed.modelo || '',
      parsed.vigencia?.desde || '',
      parsed.vigencia?.hasta || '',
      JSON.stringify(parsed.planes || []),
      JSON.stringify(parsed.condiciones_generales || []),
      parsed.seguro || '',
      JSON.stringify(parsed.identificacion_sistema || []),
      parsed.notas || '',
      parsed.explicacion || '',
      JSON.stringify(parsed),
      now,
    );

    res.json({ result: parsed, id });
  } catch (err) {
    console.error('Error en /api/credits/analyze:', err);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

// List campaigns (optional date filter)
router.get('/', authenticateToken, (req, res) => {
  const { from, to } = req.query;
  let query = 'SELECT * FROM credit_campaigns';
  const params = [];
  if (from && to) {
    query += ' WHERE date(created_at) >= date(?) AND date(created_at) <= date(?)';
    params.push(from, to);
  } else if (from) {
    query += ' WHERE date(created_at) >= date(?)';
    params.push(from);
  } else if (to) {
    query += ' WHERE date(created_at) <= date(?)';
    params.push(to);
  }
  query += ' ORDER BY created_at DESC';
  const rows = db.prepare(query).all(...params);
  const campaigns = rows.map((r) => ({
    ...r,
    planes: JSON.parse(r.planes),
    condiciones_generales: JSON.parse(r.condiciones_generales),
    identificacion_sistema: JSON.parse(r.identificacion_sistema),
    raw_result: JSON.parse(r.raw_result),
  }));
  res.json({ campaigns });
});

// Delete campaign
router.delete('/:id', authenticateToken, (req, res) => {
  db.prepare('DELETE FROM credit_campaigns WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
