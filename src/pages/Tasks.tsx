import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Trash2, Car, Users, Wrench } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Input';
import { confirmDialog } from '../components/ui/Feedback';
import { formatDate, taskStatusLabel, taskStatusColor, taskPriorityLabel, taskPriorityColor, supplierTypeLabel, vehicleLabel } from '../utils/formatters';
import type { TaskStatus, TaskPriority } from '../types';

const STATUS_COLUMNS: TaskStatus[] = ['pendiente', 'en_proceso', 'terminado'];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Media' },
  { value: 'baja', label: 'Baja' },
];

const INITIAL_FORM = {
  title: '', description: '', status: 'pendiente' as TaskStatus,
  priority: 'media' as TaskPriority,
  vehicleId: '', clientId: '', supplierId: '', dueDate: '',
};

export function Tasks() {
  const navigate = useNavigate();
  const { tasks, vehicles, clients, suppliers, addTask, updateTask, deleteTask } = useStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const filtered = tasks.filter((t) =>
    search === '' || t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.description.toLowerCase().includes(search.toLowerCase())
  );

  const byStatus = (status: TaskStatus) => filtered.filter((t) => t.status === status);

  const handleSave = () => {
    if (!form.title) return;
    addTask({
      ...form,
      vehicleId: form.vehicleId || undefined,
      clientId: form.clientId || undefined,
      supplierId: form.supplierId || undefined,
      dueDate: form.dueDate || undefined,
    });
    setShowModal(false);
    setForm(INITIAL_FORM);
  };

  const getLinkedLabel = (task: typeof tasks[0]) => {
    if (task.vehicleId) {
      const v = vehicles.find((v) => v.id === task.vehicleId);
      return v ? { icon: <Car size={11} />, label: vehicleLabel(v.brand, v.model, v.year), link: `/vehiculos/${v.id}` } : null;
    }
    if (task.clientId) {
      const c = clients.find((c) => c.id === task.clientId);
      return c ? { icon: <Users size={11} />, label: `${c.firstName} ${c.lastName}`, link: `/clientes/${c.id}` } : null;
    }
    if (task.supplierId) {
      const s = suppliers.find((s) => s.id === task.supplierId);
      return s ? { icon: <Wrench size={11} />, label: s.name, link: `/proveedores/${s.id}` } : null;
    }
    return null;
  };

  const today = new Date().toISOString().split('T')[0];

  const columnConfig = {
    pendiente:  { bg: 'bg-slate-50 border-slate-200', header: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
    en_proceso: { bg: 'bg-amber-50 border-amber-200', header: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
    terminado:  { bg: 'bg-green-50 border-green-200', header: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  };

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Tareas</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {tasks.filter((t) => t.status !== 'terminado').length} tareas pendientes
          </p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} /> Nueva tarea
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tarea..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-brand-600 focus:border-brand-600"
        />
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {STATUS_COLUMNS.map((status) => {
          const col = columnConfig[status];
          const colTasks = byStatus(status);
          return (
            <div key={status} className={`rounded-xl border ${col.bg} p-4 space-y-3`}>
              {/* Column header */}
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${col.header}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold">{taskStatusLabel[status]}</span>
                </div>
                <span className="text-sm font-bold">{colTasks.length}</span>
              </div>

              {/* Tasks */}
              {colTasks.map((task) => {
                const linked = getLinkedLabel(task);
                const isOverdue = task.dueDate && task.status !== 'terminado' && task.dueDate < today;
                return (
                  <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 flex-1">{task.title}</p>
                      <button onClick={() => confirmDialog({ title: 'Eliminar tarea', message: `¿Eliminar la tarea "${task.title}"?`, confirmLabel: 'Eliminar', danger: true }).then((ok) => ok && deleteTask(task.id))} className="text-slate-200 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                    )}

                    {linked && (
                      <button
                        onClick={() => navigate(linked.link)}
                        className="flex items-center gap-1 text-xs text-brand-600 hover:underline mt-2"
                      >
                        {linked.icon} {linked.label}
                      </button>
                    )}

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${taskPriorityColor[task.priority]}`}>
                          {taskPriorityLabel[task.priority]}
                        </span>
                        {task.dueDate && (
                          <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                            {isOverdue ? '⚠ ' : ''}{formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>

                      {/* Status toggle */}
                      <select
                        value={task.status}
                        onChange={(e) => updateTask(task.id, { status: e.target.value as TaskStatus })}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-600 focus:ring-1 focus:ring-brand-600"
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="en_proceso">En proceso</option>
                        <option value="terminado">Terminado</option>
                      </select>
                    </div>
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-4">Sin tareas</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setForm(INITIAL_FORM); }}
        title="Nueva tarea"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowModal(false); setForm(INITIAL_FORM); }}>Cancelar</Button>
            <Button onClick={handleSave}>Crear tarea</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Título" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Ej: Revisar frenos del Ranger"
          />
          <Textarea
            label="Descripción" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Detalle de la tarea..."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Prioridad" value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
              options={PRIORITY_OPTIONS}
            />
            <Input
              label="Fecha límite (opcional)" type="date" value={form.dueDate}
              onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>

          <div className="p-4 bg-slate-50 rounded-xl space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Relacionar con (opcional)</p>
            <Select
              label="Vehículo" value={form.vehicleId}
              onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value, clientId: '', supplierId: '' }))}
              options={vehicles.filter((v) => v.status !== 'vendido').map((v) => ({ value: v.id, label: vehicleLabel(v.brand, v.model, v.year) }))}
              placeholder="Sin vehículo"
            />
            <Select
              label="Cliente" value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value, vehicleId: '', supplierId: '' }))}
              options={clients.map((c) => ({ value: c.id, label: `${c.firstName} ${c.lastName}` }))}
              placeholder="Sin cliente"
            />
            <Select
              label="Proveedor" value={form.supplierId}
              onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value, vehicleId: '', clientId: '' }))}
              options={suppliers.map((s) => ({ value: s.id, label: `${s.name} (${supplierTypeLabel[s.type]})` }))}
              placeholder="Sin proveedor"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
