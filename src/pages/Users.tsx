import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Pencil, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { authFetch } from '../store/authStore';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';

interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'empleado';
  active: boolean | number;
  created_at: string;
}

const EMPTY_FORM = { name: '', email: '', password: '' };

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function Users() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Edit modal
  const [editUser, setEditUser] = useState<ApiUser | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; email: string; active: boolean }>({
    name: '', email: '', active: true,
  });
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirm
  const [deleteUser, setDeleteUser] = useState<ApiUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await authFetch('/api/users');
      if (!res.ok) throw new Error('Error al cargar usuarios');
      const data = await res.json();
      setUsers(data.users as ApiUser[]);
    } catch (e) {
      setFetchError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Create ─────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setCreateError('');
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      setCreateError('Todos los campos son obligatorios');
      return;
    }
    setCreateLoading(true);
    try {
      const res = await authFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? 'Error al crear usuario');
      }
      setCreateOpen(false);
      setCreateForm(EMPTY_FORM);
      await fetchUsers();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Edit ───────────────────────────────────────────────────────────────────
  const openEdit = (user: ApiUser) => {
    setEditUser(user);
    setEditForm({ name: user.name, email: user.email, active: !!user.active });
    setEditError('');
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setEditError('');
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setEditError('Nombre y email son obligatorios');
      return;
    }
    setEditLoading(true);
    try {
      const res = await authFetch(`/api/users/${editUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? 'Error al actualizar usuario');
      }
      setEditUser(null);
      await fetchUsers();
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setEditLoading(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteUser) return;
    setDeleteError('');
    setDeleteLoading(true);
    try {
      const res = await authFetch(`/api/users/${deleteUser.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error ?? 'Error al eliminar usuario');
      }
      setDeleteUser(null);
      await fetchUsers();
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? 'Cargando…' : `${users.length} usuario${users.length !== 1 ? 's' : ''} registrado${users.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => { setCreateOpen(true); setCreateForm(EMPTY_FORM); setCreateError(''); }}
        >
          <UserPlus size={16} />
          Nuevo usuario
        </Button>
      </div>

      {/* Table */}
      <Card padding={false}>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Cargando usuarios…</span>
          </div>
        ) : fetchError ? (
          <div className="flex items-center justify-center gap-2 py-16 text-red-600 text-sm">
            <AlertCircle size={16} />
            {fetchError}
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No hay usuarios registrados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rol</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Creado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{user.name}</td>
                    <td className="px-5 py-3.5 text-slate-600">{user.email}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={user.role === 'admin' ? 'purple' : 'info'}>
                        {user.role === 'admin' ? 'Administrador' : 'Empleado'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={user.active ? 'success' : 'default'}>
                        {user.active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">{formatDate(user.created_at)}</td>
                    <td className="px-5 py-3.5">
                      {user.role !== 'admin' ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(user)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => { setDeleteUser(user); setDeleteError(''); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">protegido</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Create Modal ── */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo usuario"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createLoading}>
              Cancelar
            </Button>
            <Button variant="primary" loading={createLoading} onClick={handleCreate}>
              Crear usuario
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre completo"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="María García"
            autoFocus
          />
          <Input
            label="Correo electrónico"
            type="email"
            value={createForm.email}
            onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="maria@majaautomotores.com"
          />
          <Input
            label="Contraseña"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="Mínimo 6 caracteres"
          />
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-600">
            <span className="font-medium">Rol:</span> Empleado
            <span className="text-slate-400 ml-1">(los empleados solo pueden acceder a Vehículos, Clientes y Tareas)</span>
          </div>
          {createError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3.5 py-3 text-sm text-red-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {createError}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title="Editar usuario"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={editLoading}>
              Cancelar
            </Button>
            <Button variant="primary" loading={editLoading} onClick={handleEdit}>
              Guardar cambios
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nombre completo"
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <Input
            label="Correo electrónico"
            type="email"
            value={editForm.email}
            onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
          />
          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-slate-700">Estado de la cuenta</span>
            <button
              type="button"
              onClick={() => setEditForm((f) => ({ ...f, active: !f.active }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                editForm.active ? 'bg-brand-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
                  editForm.active ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {editError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3.5 py-3 text-sm text-red-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {editError}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal
        isOpen={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        title="Eliminar usuario"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={deleteLoading}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleteLoading} onClick={handleDelete}>
              Eliminar
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            ¿Estás seguro que querés eliminar al usuario{' '}
            <span className="font-semibold">{deleteUser?.name}</span>?
            Esta acción no se puede deshacer.
          </p>
          {deleteError && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3.5 py-3 text-sm text-red-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {deleteError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
