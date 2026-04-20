import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/analyze', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const imagePart = {
    inlineData: {
      data: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype,
    },
  };

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

  const result = await model.generateContent([prompt, imagePart]);
  const text = result.response.text().trim();

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
});

export default router;
