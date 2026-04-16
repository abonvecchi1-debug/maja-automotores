/**
 * Script para crear el usuario administrador inicial.
 *
 * Uso:
 *   node server/seed-admin.js
 *
 * Opciones (variables de entorno):
 *   ADMIN_NAME     Nombre del admin (default: Administrador)
 *   ADMIN_EMAIL    Email del admin (default: admin@maja.com)
 *   ADMIN_PASSWORD Contraseña     (default: admin123)
 *
 * Ejemplo personalizado:
 *   ADMIN_EMAIL=juan@maja.com ADMIN_PASSWORD=miClave123 node server/seed-admin.js
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './db.js';

const name     = process.env.ADMIN_NAME     || 'Administrador';
const email    = (process.env.ADMIN_EMAIL    || 'admin@maja.com').toLowerCase().trim();
const password = process.env.ADMIN_PASSWORD  || 'admin123';

// ── Validaciones ─────────────────────────────────────────────────────────

if (password.length < 6) {
  console.error('Error: la contraseña debe tener al menos 6 caracteres.');
  process.exit(1);
}

// Solo puede haber UN admin en el sistema
const existingAdmin = db.prepare("SELECT id, email FROM users WHERE role = 'admin' AND active = 1").get();

if (existingAdmin) {
  console.log('');
  console.log(`Ya existe un administrador activo: ${existingAdmin.email} (id: ${existingAdmin.id})`);
  console.log('Solo puede haber un administrador en el sistema.');
  console.log('Si necesitás reemplazarlo, desactivá primero el actual desde la base de datos.');
  console.log('');
  process.exit(0);
}

// ── Crear admin ──────────────────────────────────────────────────────────

// Verificar si el email ya está usado por otro usuario
const emailTaken = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);
if (emailTaken) {
  console.error(`Error: ya existe un usuario con el email ${email} (id: ${emailTaken.id}, rol: ${emailTaken.role}).`);
  process.exit(1);
}

const hashedPassword = bcrypt.hashSync(password, 10);

db.prepare(
  'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
).run(name, email, hashedPassword, 'admin');

console.log('');
console.log('✅ Administrador creado exitosamente');
console.log('');
console.log(`   Nombre:     ${name}`);
console.log(`   Email:      ${email}`);
console.log(`   Contraseña: ${password}`);
console.log('');
console.log('   Usá estas credenciales para iniciar sesión en http://localhost:5173');
console.log('');
