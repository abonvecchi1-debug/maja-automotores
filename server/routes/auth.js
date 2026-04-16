import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'maja-automotores-secret-key-2024';

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email);

  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const passwordValid = bcrypt.compareSync(password, user.password);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

  const { password: _pw, ...userWithoutPassword } = user;

  res.json({ token, user: userWithoutPassword });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare(
    'SELECT id, name, email, role, active, created_at FROM users WHERE id = ? AND active = 1'
  ).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  res.json({ user });
});

// POST /api/auth/change-password
router.post('/change-password', authenticateToken, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Contraseña actual y nueva contraseña son requeridas' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ? AND active = 1').get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  const passwordValid = bcrypt.compareSync(currentPassword, user.password);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Contraseña actual incorrecta' });
  }

  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, user.id);

  res.json({ message: 'Contraseña actualizada correctamente' });
});

export default router;
