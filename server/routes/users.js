import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All user routes require authentication and admin role
router.use(authenticateToken, requireAdmin);

// GET /api/users - List all users
router.get('/', (req, res) => {
  const users = db.prepare(
    'SELECT id, name, email, role, active, created_at FROM users ORDER BY created_at DESC'
  ).all();

  res.json({ users });
});

// POST /api/users - Create new user (solo empleados, no admin)
router.post('/', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  // RESTRICCIÓN: solo se pueden crear empleados desde la interfaz.
  // El admin se crea exclusivamente con el script seed-admin.js
  const userRole = 'empleado';

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existingUser) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const result = db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), email.toLowerCase().trim(), hashedPassword, userRole);

    const newUser = db.prepare(
      'SELECT id, name, email, role, active, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);

    res.status(201).json({ user: newUser });
  } catch (err) {
    res.status(500).json({ error: 'Error al crear el usuario' });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, active } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // RESTRICCIÓN: no se puede cambiar el rol del admin ni desactivarlo
  if (user.role === 'admin') {
    return res.status(403).json({ error: 'No se puede modificar al administrador desde la interfaz' });
  }

  // RESTRICCIÓN: no se puede promover a admin desde la interfaz
  // (ignoramos el campo role completamente)
  const updatedName = name !== undefined ? name.trim() : user.name;
  const updatedEmail = email !== undefined ? email.toLowerCase().trim() : user.email;
  const updatedActive = active !== undefined ? (active ? 1 : 0) : user.active;

  // Check email uniqueness if changing email
  if (updatedEmail !== user.email) {
    const emailTaken = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(updatedEmail, id);
    if (emailTaken) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }
  }

  try {
    db.prepare(
      'UPDATE users SET name = ?, email = ?, active = ? WHERE id = ?'
    ).run(updatedName, updatedEmail, updatedActive, id);

    const updatedUser = db.prepare(
      'SELECT id, name, email, role, active, created_at FROM users WHERE id = ?'
    ).get(id);

    res.json({ user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

// DELETE /api/users/:id - Hard delete
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  // Prevent deleting own account
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  // RESTRICCIÓN: no se puede eliminar al admin
  if (user.role === 'admin') {
    return res.status(403).json({ error: 'No se puede eliminar al administrador' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id);

  res.json({ message: 'Usuario eliminado correctamente' });
});

export default router;
