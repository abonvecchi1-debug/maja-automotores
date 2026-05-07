import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import db from '../db.js';

const router = express.Router();

router.get('/balance', authenticateToken, requireAdmin, (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'Se requieren from y to' });

  // Ventas del período
  const ventas = db.prepare(`
    SELECT s.id, s.sale_date, s.sale_price, s.payment_type,
           v.brand, v.model, v.year, v.patent, v.purchase_price,
           c.first_name || ' ' || c.last_name AS client_name
    FROM sales s
    LEFT JOIN vehicles v ON v.id = s.vehicle_id
    LEFT JOIN clients c ON c.id = s.client_id
    WHERE s.sale_date >= ? AND s.sale_date <= ?
    ORDER BY s.sale_date
  `).all(from, to);

  // Vehículos comprados en el período
  const compras = db.prepare(`
    SELECT id, brand, model, year, patent, purchase_date, purchase_price, status
    FROM vehicles
    WHERE purchase_date >= ? AND purchase_date <= ?
    ORDER BY purchase_date
  `).all(from, to);

  // Gastos variables del período
  const gastos = db.prepare(`
    SELECT e.id, e.description, e.date, e.amount, e.category, e.paid,
           v.brand || ' ' || v.model AS vehicle_name,
           s.name AS supplier_name
    FROM expenses e
    LEFT JOIN vehicles v ON v.id = e.vehicle_id
    LEFT JOIN suppliers s ON s.id = e.supplier_id
    WHERE e.date >= ? AND e.date <= ?
    ORDER BY e.date
  `).all(from, to);

  // Gastos fijos del período (por mes dentro del rango)
  const gastosFijos = db.prepare(`
    SELECT id, type_name, month, amount, due_date, paid, paid_date
    FROM fixed_expense_records
    WHERE month >= substr(?, 1, 7) AND month <= substr(?, 1, 7)
    ORDER BY month, due_date
  `).all(from, to);

  // Egresos e ingresos registrados en Finanzas
  const egresosFinanzas = db.prepare(`
    SELECT id, description, date, amount, category
    FROM transactions
    WHERE type = 'egreso' AND date >= ? AND date <= ?
    ORDER BY date
  `).all(from, to);

  const ingresosFinanzas = db.prepare(`
    SELECT id, description, date, amount, category
    FROM transactions
    WHERE type = 'ingreso' AND date >= ? AND date <= ?
    ORDER BY date
  `).all(from, to);

  // Totales
  const totalVentas = ventas.reduce((s, v) => s + (v.sale_price || 0), 0);
  const totalIngresosFinanzas = ingresosFinanzas.reduce((s, t) => s + (t.amount || 0), 0);
  const totalCostoVendidos = ventas.reduce((s, v) => s + (v.purchase_price || 0), 0);
  const utilidadBruta = totalVentas + totalIngresosFinanzas - totalCostoVendidos;
  const totalGastos = gastos.reduce((s, g) => s + (g.amount || 0), 0);
  const totalGastosFijos = gastosFijos.reduce((s, g) => s + (g.amount || 0), 0);
  const totalEgresosFinanzas = egresosFinanzas.reduce((s, t) => s + (t.amount || 0), 0);
  const totalCompras = compras.reduce((s, c) => s + (c.purchase_price || 0), 0);
  const utilidadNeta = utilidadBruta - totalGastos - totalGastosFijos - totalEgresosFinanzas;

  res.json({
    periodo: { from, to },
    resumen: {
      total_ventas: totalVentas,
      total_ingresos_finanzas: totalIngresosFinanzas,
      cantidad_ventas: ventas.length,
      costo_vehiculos_vendidos: totalCostoVendidos,
      utilidad_bruta: utilidadBruta,
      total_gastos_variables: totalGastos,
      total_gastos_fijos: totalGastosFijos,
      total_egresos_finanzas: totalEgresosFinanzas,
      total_gastos: totalGastos + totalGastosFijos + totalEgresosFinanzas,
      utilidad_neta: utilidadNeta,
      total_compras: totalCompras,
      cantidad_compras: compras.length,
    },
    ventas,
    compras,
    gastos,
    gastos_fijos: gastosFijos,
    egresos_finanzas: egresosFinanzas,
    ingresos_finanzas: ingresosFinanzas,
  });
});

export default router;
