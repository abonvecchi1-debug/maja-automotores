import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bcrypt from 'bcryptjs';

import db from './db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import uploadRoutes from './routes/upload.js';
import vehiclesRoutes from './routes/vehicles.js';
import clientsRoutes from './routes/clients.js';
import salesRoutes from './routes/sales.js';
import suppliersRoutes from './routes/suppliers.js';
import expensesRoutes from './routes/expenses.js';
import fixedExpensesRoutes from './routes/fixedExpenses.js';
import tasksRoutes from './routes/tasks.js';
import transactionsRoutes from './routes/transactions.js';
import transfersRoutes from './routes/transfers.js';
import leadsRoutes from './routes/leads.js';
import dailyCashRoutes from './routes/dailyCash.js';
import taxPaymentsRoutes from './routes/taxPayments.js';
import settingsRoutes from './routes/settings.js';
import dataRoutes from './routes/data.js';
import creditsRoutes from './routes/credits.js';
import reportsRoutes from './routes/reports.js';
import chequesRoutes from './routes/cheques.js';
import syncRoutes from './routes/sync.js';
import publicRoutes from './routes/public.js';
import { start as startSync } from './sync-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.SERVER_PORT || 3001;
const isDev = process.env.NODE_ENV !== 'production';

// Middleware
if (isDev) {
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
}
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files
const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// In production, serve the built React app
if (!isDev) {
  const distPath = process.env.DIST_PATH || path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }
}

// API Routes
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/vehicles', vehiclesRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/fixed-expenses', fixedExpensesRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/daily-cash', dailyCashRoutes);
app.use('/api/tax-payments', taxPaymentsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/cheques', chequesRoutes);
app.use('/api/sync', syncRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// In production, all non-API routes serve the React app
if (!isDev) {
  const distPath = process.env.DIST_PATH || path.join(__dirname, '../dist');
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
  if (adminCount.count === 0) {
    const hashedPw = bcrypt.hashSync('Maja2024!', 10);
    db.prepare("INSERT INTO users (name, email, password, role, active) VALUES (?, ?, ?, 'admin', 1)")
      .run('Administrador', 'admin@maja.com', hashedPw);
  }
  console.log(`Servidor Maja Automotores corriendo en http://localhost:${PORT}`);
  startSync();
});
