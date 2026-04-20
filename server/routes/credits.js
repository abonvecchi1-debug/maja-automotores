import express from 'express';
import Groq from 'groq-sdk';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/analyze', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });
    if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY no configurada' });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    const prompt = `Analizá esta hoja de créditos/campañas de financiamiento automotor y devolvé la información estructurada en JSON con este formato exacto:
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
  "notas": "cualquier aclaración importante"
}
Devolvé SOLO el JSON, sin texto extra ni markdown ni bloques de código.`;

    const completion = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 2048,
    });

    const text = completion.choices[0].message.content.trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      try {
        parsed = match ? JSON.parse(match[0]) : { raw: text };
      } catch {
        parsed = { raw: text };
      }
    }

    res.json({ result: parsed });
  } catch (err) {
    console.error('Error en /api/credits/analyze:', err);
    res.status(500).json({ error: err.message || 'Error interno' });
  }
});

export default router;
