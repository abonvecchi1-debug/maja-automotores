import express from 'express';

// Cotización del dólar blue en vivo (dato público de mercado). Se cachea unos minutos para
// no golpear las APIs, y usa una de respaldo si la primera falla. No requiere login.
const router = express.Router();

let cache = null; // { data: { compra, venta, fecha, fuente }, fetchedAt }
const TTL_MS = 8 * 60 * 1000; // 8 min

async function fetchBlue() {
  // 1) dolarapi.com
  try {
    const r = await fetch('https://dolarapi.com/v1/dolares/blue', { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const d = await r.json();
      if (d && d.venta) return { compra: d.compra, venta: d.venta, fecha: d.fechaActualizacion, fuente: 'dolarapi.com' };
    }
  } catch {}
  // 2) bluelytics (respaldo)
  const r2 = await fetch('https://api.bluelytics.com.ar/v2/latest', { signal: AbortSignal.timeout(8000) });
  const d2 = await r2.json();
  return { compra: d2.blue.value_buy, venta: d2.blue.value_sell, fecha: new Date().toISOString(), fuente: 'bluelytics.com.ar' };
}

router.get('/blue', async (req, res) => {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return res.json(cache.data);
  try {
    const data = await fetchBlue();
    cache = { data, fetchedAt: Date.now() };
    res.json(data);
  } catch {
    if (cache) return res.json(cache.data); // último valor conocido si se cae internet
    res.status(503).json({ error: 'No se pudo obtener el dólar blue (¿sin internet?)' });
  }
});

export default router;
