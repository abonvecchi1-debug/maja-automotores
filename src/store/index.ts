import { create } from 'zustand';
import { authFetch } from './authStore';
import type {
  Vehicle, Expense, Client, Sale, InstallmentPayment,
  Supplier, FixedExpenseType, FixedExpenseRecord,
  Task, Transaction, AppSettings,
  Transfer08, Lead, DailyCash, CashMovement, TaxPayment,
} from '../types';

// ─── Store Interface ───────────────────────────────────────────────────────

interface AppStore {
  vehicles: Vehicle[];
  expenses: Expense[];
  clients: Client[];
  sales: Sale[];
  installmentPayments: InstallmentPayment[];
  suppliers: Supplier[];
  fixedExpenseTypes: FixedExpenseType[];
  fixedExpenseRecords: FixedExpenseRecord[];
  tasks: Task[];
  transactions: Transaction[];
  settings: AppSettings;
  transfers: Transfer08[];
  leads: Lead[];
  dailyCashes: DailyCash[];
  cashMovements: CashMovement[];
  taxPayments: TaxPayment[];

  initialized: boolean;
  loading: boolean;

  loadAll: () => Promise<void>;

  addVehicle: (v: Omit<Vehicle, 'id' | 'createdAt'>) => void;
  updateVehicle: (id: string, data: Partial<Vehicle>) => void;
  deleteVehicle: (id: string) => void;

  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  markExpensePaid: (id: string) => void;

  addClient: (c: Omit<Client, 'id' | 'createdAt'>) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  addSale: (s: Omit<Sale, 'id' | 'createdAt'>, payments: Omit<InstallmentPayment, 'id'>[]) => void;
  markInstallmentPaid: (id: string) => void;

  addSupplier: (s: Omit<Supplier, 'id' | 'createdAt'>) => void;
  updateSupplier: (id: string, data: Partial<Supplier>) => void;
  deleteSupplier: (id: string) => void;

  addFixedExpenseType: (t: Omit<FixedExpenseType, 'id' | 'createdAt'>) => void;
  updateFixedExpenseType: (id: string, data: Partial<FixedExpenseType>) => void;
  deleteFixedExpenseType: (id: string) => void;
  addFixedExpenseRecord: (r: Omit<FixedExpenseRecord, 'id'>) => void;
  updateFixedExpenseRecord: (id: string, data: Partial<FixedExpenseRecord>) => void;
  markFixedExpensePaid: (id: string) => void;
  generateMonthlyRecords: (month: string) => void;

  addTask: (t: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  deleteTask: (id: string) => void;

  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'>) => void;
  deleteTransaction: (id: string) => void;

  updateSettings: (s: Partial<AppSettings>) => void;

  addTransfer: (t: Omit<Transfer08, 'id' | 'createdAt'>) => void;
  updateTransfer: (id: string, data: Partial<Transfer08>) => void;
  deleteTransfer: (id: string) => void;

  addLead: (l: Omit<Lead, 'id' | 'createdAt' | 'contactHistory'>) => void;
  updateLead: (id: string, data: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addContactEntry: (leadId: string, note: string) => void;

  openDailyCash: (date: string, openingBalance: number) => void;
  closeDailyCash: (id: string, closingBalance: number, notes?: string) => void;
  addCashMovement: (m: Omit<CashMovement, 'id' | 'createdAt'>) => void;
  deleteCashMovement: (id: string) => void;

  addTaxPayment: (t: Omit<TaxPayment, 'id' | 'createdAt'>) => void;
  updateTaxPayment: (id: string, data: Partial<TaxPayment>) => void;
  deleteTaxPayment: (id: string) => void;
  markTaxPaid: (id: string) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const today = () => new Date().toISOString().split('T')[0];

// Fire-and-forget API call. On failure, run revert().
function sync(call: () => Promise<void>, revert?: () => void) {
  call().catch((err) => {
    console.error('[store sync error]', err);
    revert?.();
  });
}

// ─── Store ────────────────────────────────────────────────────────────────

export const useStore = create<AppStore>((set, get) => ({
  vehicles: [], expenses: [], clients: [], sales: [], installmentPayments: [],
  suppliers: [], fixedExpenseTypes: [], fixedExpenseRecords: [], tasks: [],
  transactions: [], transfers: [], leads: [], dailyCashes: [], cashMovements: [],
  taxPayments: [],
  settings: { iibbRate: 3, province: 'Buenos Aires', businessName: 'Maja Automotores', cuit: '', currency: 'ARS' },
  initialized: false,
  loading: false,

  // ── Load all from server ───────────────────────────────────────────────
  loadAll: async () => {
    set({ loading: true });
    try {
      const res = await authFetch('/api/data');
      if (!res.ok) throw new Error('Failed to load data');
      const data = await res.json();
      set({
        vehicles: data.vehicles ?? [],
        clients: data.clients ?? [],
        sales: data.sales ?? [],
        installmentPayments: data.installmentPayments ?? [],
        suppliers: data.suppliers ?? [],
        expenses: data.expenses ?? [],
        fixedExpenseTypes: data.fixedExpenseTypes ?? [],
        fixedExpenseRecords: data.fixedExpenseRecords ?? [],
        tasks: data.tasks ?? [],
        transactions: data.transactions ?? [],
        transfers: data.transfers ?? [],
        leads: data.leads ?? [],
        dailyCashes: data.dailyCashes ?? [],
        cashMovements: data.cashMovements ?? [],
        taxPayments: data.taxPayments ?? [],
        settings: data.settings ?? get().settings,
        initialized: true,
        loading: false,
      });
    } catch (err) {
      console.error('[loadAll error]', err);
      set({ loading: false, initialized: true });
    }
  },

  // ── Vehicles ───────────────────────────────────────────────────────────
  addVehicle: (v) => {
    const tempId = uid();
    const optimistic: Vehicle = {
      ...v, id: tempId, createdAt: now(),
      images: v.images ?? [], publishLinks: v.publishLinks ?? [], priceHistory: v.priceHistory ?? [],
      documents: v.documents ?? { titulo: false, cedulaVerde: false, cedulaAzul: false, vtv: false, libreDeuda: false, verificacionPolicial: false, seguro: false },
    };
    set((s) => ({ vehicles: [...s.vehicles, optimistic] }));
    sync(
      () => authFetch('/api/vehicles', { method: 'POST', body: JSON.stringify(v) })
        .then((r) => r.json())
        .then(({ vehicle }) => set((s) => ({ vehicles: s.vehicles.map((x) => x.id === tempId ? vehicle : x) }))),
      () => set((s) => ({ vehicles: s.vehicles.filter((x) => x.id !== tempId) }))
    );
  },
  updateVehicle: (id, data) => {
    set((s) => ({ vehicles: s.vehicles.map((v) => v.id === id ? { ...v, ...data } : v) }));
    sync(() => authFetch(`/api/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  deleteVehicle: (id) => {
    const prev = get().vehicles;
    set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) }));
    sync(
      () => authFetch(`/api/vehicles/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ vehicles: prev })
    );
  },

  // ── Expenses ───────────────────────────────────────────────────────────
  addExpense: (e) => {
    const tempId = uid();
    const optimistic: Expense = { ...e, id: tempId, createdAt: now() };
    set((s) => ({ expenses: [...s.expenses, optimistic] }));
    sync(
      () => authFetch('/api/expenses', { method: 'POST', body: JSON.stringify(e) })
        .then((r) => r.json())
        .then(({ expense }) => set((s) => ({ expenses: s.expenses.map((x) => x.id === tempId ? expense : x) }))),
      () => set((s) => ({ expenses: s.expenses.filter((x) => x.id !== tempId) }))
    );
  },
  updateExpense: (id, data) => {
    set((s) => ({ expenses: s.expenses.map((e) => e.id === id ? { ...e, ...data } : e) }));
    sync(() => authFetch(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  deleteExpense: (id) => {
    const prev = get().expenses;
    set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }));
    sync(
      () => authFetch(`/api/expenses/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ expenses: prev })
    );
  },
  markExpensePaid: (id) => {
    set((s) => ({ expenses: s.expenses.map((e) => e.id === id ? { ...e, paid: true, paidDate: today() } : e) }));
    sync(() => authFetch(`/api/expenses/${id}/pay`, { method: 'PUT' }).then(() => {}));
  },

  // ── Clients ────────────────────────────────────────────────────────────
  addClient: (c) => {
    const tempId = uid();
    const optimistic: Client = { ...c, id: tempId, createdAt: now() };
    set((s) => ({ clients: [...s.clients, optimistic] }));
    sync(
      () => authFetch('/api/clients', { method: 'POST', body: JSON.stringify(c) })
        .then((r) => r.json())
        .then(({ client }) => set((s) => ({ clients: s.clients.map((x) => x.id === tempId ? client : x) }))),
      () => set((s) => ({ clients: s.clients.filter((x) => x.id !== tempId) }))
    );
  },
  updateClient: (id, data) => {
    set((s) => ({ clients: s.clients.map((c) => c.id === id ? { ...c, ...data } : c) }));
    sync(() => authFetch(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  deleteClient: (id) => {
    const prev = get().clients;
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
    sync(
      () => authFetch(`/api/clients/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ clients: prev })
    );
  },

  // ── Sales ──────────────────────────────────────────────────────────────
  addSale: (s, payments) => {
    const saleId = uid();
    const newSale: Sale = { ...s, id: saleId, createdAt: now() };
    const newPayments: InstallmentPayment[] = payments.map((p) => ({ ...p, id: uid(), saleId }));
    set((st) => ({
      sales: [...st.sales, newSale],
      installmentPayments: [...st.installmentPayments, ...newPayments],
      vehicles: st.vehicles.map((v) =>
        v.id === s.vehicleId ? { ...v, status: 'vendido' as const, soldPrice: s.salePrice, soldDate: s.saleDate, soldToClientId: s.clientId, saleId } : v
      ),
    }));
    sync(
      () => authFetch('/api/sales', { method: 'POST', body: JSON.stringify({ sale: s, payments }) })
        .then((r) => r.json())
        .then(({ sale, payments: pms }) => {
          set((st) => ({
            sales: st.sales.map((x) => x.id === saleId ? sale : x),
            installmentPayments: [...st.installmentPayments.filter((x) => !newPayments.find((p) => p.id === x.id)), ...pms],
          }));
        })
    );
  },
  markInstallmentPaid: (id) => {
    set((s) => ({ installmentPayments: s.installmentPayments.map((p) => p.id === id ? { ...p, paid: true, paidDate: today() } : p) }));
    sync(() => authFetch(`/api/sales/installments/${id}/pay`, { method: 'PUT' }).then(() => {}));
  },

  // ── Suppliers ──────────────────────────────────────────────────────────
  addSupplier: (s) => {
    const tempId = uid();
    set((st) => ({ suppliers: [...st.suppliers, { ...s, id: tempId, createdAt: now() }] }));
    sync(
      () => authFetch('/api/suppliers', { method: 'POST', body: JSON.stringify(s) })
        .then((r) => r.json())
        .then(({ supplier }) => set((st) => ({ suppliers: st.suppliers.map((x) => x.id === tempId ? supplier : x) }))),
      () => set((st) => ({ suppliers: st.suppliers.filter((x) => x.id !== tempId) }))
    );
  },
  updateSupplier: (id, data) => {
    set((s) => ({ suppliers: s.suppliers.map((sp) => sp.id === id ? { ...sp, ...data } : sp) }));
    sync(() => authFetch(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  deleteSupplier: (id) => {
    const prev = get().suppliers;
    set((s) => ({ suppliers: s.suppliers.filter((sp) => sp.id !== id) }));
    sync(
      () => authFetch(`/api/suppliers/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ suppliers: prev })
    );
  },

  // ── Fixed Expenses ─────────────────────────────────────────────────────
  addFixedExpenseType: (t) => {
    const tempId = uid();
    set((s) => ({ fixedExpenseTypes: [...s.fixedExpenseTypes, { ...t, id: tempId, createdAt: now() }] }));
    sync(
      () => authFetch('/api/fixed-expenses/types', { method: 'POST', body: JSON.stringify(t) })
        .then((r) => r.json())
        .then(({ type }) => set((s) => ({ fixedExpenseTypes: s.fixedExpenseTypes.map((x) => x.id === tempId ? type : x) }))),
      () => set((s) => ({ fixedExpenseTypes: s.fixedExpenseTypes.filter((x) => x.id !== tempId) }))
    );
  },
  updateFixedExpenseType: (id, data) => {
    set((s) => ({ fixedExpenseTypes: s.fixedExpenseTypes.map((t) => t.id === id ? { ...t, ...data } : t) }));
    sync(() => authFetch(`/api/fixed-expenses/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  deleteFixedExpenseType: (id) => {
    const prev = get().fixedExpenseTypes;
    set((s) => ({ fixedExpenseTypes: s.fixedExpenseTypes.filter((t) => t.id !== id) }));
    sync(
      () => authFetch(`/api/fixed-expenses/types/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ fixedExpenseTypes: prev })
    );
  },
  addFixedExpenseRecord: (r) => {
    const tempId = uid();
    set((s) => ({ fixedExpenseRecords: [...s.fixedExpenseRecords, { ...r, id: tempId }] }));
    sync(
      () => authFetch('/api/fixed-expenses/records', { method: 'POST', body: JSON.stringify(r) })
        .then((res) => res.json())
        .then(({ record }) => set((s) => ({ fixedExpenseRecords: s.fixedExpenseRecords.map((x) => x.id === tempId ? record : x) }))),
      () => set((s) => ({ fixedExpenseRecords: s.fixedExpenseRecords.filter((x) => x.id !== tempId) }))
    );
  },
  updateFixedExpenseRecord: (id, data) => {
    set((s) => ({ fixedExpenseRecords: s.fixedExpenseRecords.map((r) => r.id === id ? { ...r, ...data } : r) }));
    sync(() => authFetch(`/api/fixed-expenses/records/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  markFixedExpensePaid: (id) => {
    set((s) => ({ fixedExpenseRecords: s.fixedExpenseRecords.map((r) => r.id === id ? { ...r, paid: true, paidDate: today() } : r) }));
    sync(() => authFetch(`/api/fixed-expenses/records/${id}/pay`, { method: 'PUT' }).then(() => {}));
  },
  generateMonthlyRecords: (month) => {
    authFetch(`/api/fixed-expenses/records/generate/${month}`, { method: 'POST' })
      .then((r) => r.json())
      .then(({ records }) => {
        if (records?.length) {
          set((s) => ({ fixedExpenseRecords: [...s.fixedExpenseRecords, ...records] }));
        }
      })
      .catch((err) => console.error('[generateMonthlyRecords error]', err));
  },

  // ── Tasks ──────────────────────────────────────────────────────────────
  addTask: (t) => {
    const tempId = uid();
    set((s) => ({ tasks: [...s.tasks, { ...t, id: tempId, createdAt: now() }] }));
    sync(
      () => authFetch('/api/tasks', { method: 'POST', body: JSON.stringify(t) })
        .then((r) => r.json())
        .then(({ task }) => set((s) => ({ tasks: s.tasks.map((x) => x.id === tempId ? task : x) }))),
      () => set((s) => ({ tasks: s.tasks.filter((x) => x.id !== tempId) }))
    );
  },
  updateTask: (id, data) => {
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        const updated = { ...t, ...data };
        if (data.status === 'terminado' && !t.completedAt) updated.completedAt = now();
        return updated;
      }),
    }));
    sync(() => authFetch(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  deleteTask: (id) => {
    const prev = get().tasks;
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    sync(
      () => authFetch(`/api/tasks/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ tasks: prev })
    );
  },

  // ── Transactions ───────────────────────────────────────────────────────
  addTransaction: (t) => {
    const tempId = uid();
    set((s) => ({ transactions: [...s.transactions, { ...t, id: tempId, createdAt: now() }] }));
    sync(
      () => authFetch('/api/transactions', { method: 'POST', body: JSON.stringify(t) })
        .then((r) => r.json())
        .then(({ transaction }) => set((s) => ({ transactions: s.transactions.map((x) => x.id === tempId ? transaction : x) }))),
      () => set((s) => ({ transactions: s.transactions.filter((x) => x.id !== tempId) }))
    );
  },
  deleteTransaction: (id) => {
    const prev = get().transactions;
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
    sync(
      () => authFetch(`/api/transactions/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ transactions: prev })
    );
  },

  // ── Settings ───────────────────────────────────────────────────────────
  updateSettings: (data) => {
    set((s) => ({ settings: { ...s.settings, ...data } }));
    sync(() => authFetch('/api/settings', { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },

  // ── Transfers ──────────────────────────────────────────────────────────
  addTransfer: (t) => {
    const tempId = uid();
    set((s) => ({ transfers: [...s.transfers, { ...t, id: tempId, createdAt: now() }] }));
    sync(
      () => authFetch('/api/transfers', { method: 'POST', body: JSON.stringify(t) })
        .then((r) => r.json())
        .then(({ transfer }) => set((s) => ({ transfers: s.transfers.map((x) => x.id === tempId ? transfer : x) }))),
      () => set((s) => ({ transfers: s.transfers.filter((x) => x.id !== tempId) }))
    );
  },
  updateTransfer: (id, data) => {
    set((s) => ({ transfers: s.transfers.map((t) => t.id === id ? { ...t, ...data } : t) }));
    sync(() => authFetch(`/api/transfers/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  deleteTransfer: (id) => {
    const prev = get().transfers;
    set((s) => ({ transfers: s.transfers.filter((t) => t.id !== id) }));
    sync(
      () => authFetch(`/api/transfers/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ transfers: prev })
    );
  },

  // ── Leads ──────────────────────────────────────────────────────────────
  addLead: (l) => {
    const tempId = uid();
    set((s) => ({ leads: [...s.leads, { ...l, id: tempId, createdAt: now(), contactHistory: [] }] }));
    sync(
      () => authFetch('/api/leads', { method: 'POST', body: JSON.stringify(l) })
        .then((r) => r.json())
        .then(({ lead }) => set((s) => ({ leads: s.leads.map((x) => x.id === tempId ? lead : x) }))),
      () => set((s) => ({ leads: s.leads.filter((x) => x.id !== tempId) }))
    );
  },
  updateLead: (id, data) => {
    set((s) => ({ leads: s.leads.map((l) => l.id === id ? { ...l, ...data } : l) }));
    sync(() => authFetch(`/api/leads/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  deleteLead: (id) => {
    const prev = get().leads;
    set((s) => ({ leads: s.leads.filter((l) => l.id !== id) }));
    sync(
      () => authFetch(`/api/leads/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ leads: prev })
    );
  },
  addContactEntry: (leadId, note) => {
    const entryId = uid();
    const entry = { id: entryId, date: now(), note };
    set((s) => ({
      leads: s.leads.map((l) => l.id === leadId ? { ...l, contactHistory: [...l.contactHistory, entry] } : l),
    }));
    sync(() => authFetch(`/api/leads/${leadId}/contact`, { method: 'POST', body: JSON.stringify({ note }) }).then(() => {}));
  },

  // ── Daily Cash ─────────────────────────────────────────────────────────
  openDailyCash: (date, openingBalance) => {
    const tempId = uid();
    const optimistic: DailyCash = { id: tempId, date, openingBalance, closed: false, notes: '', createdAt: now() };
    set((s) => ({ dailyCashes: [...s.dailyCashes, optimistic] }));
    sync(
      () => authFetch('/api/daily-cash/open', { method: 'POST', body: JSON.stringify({ date, openingBalance }) })
        .then((r) => r.json())
        .then(({ dailyCash }) => set((s) => ({ dailyCashes: s.dailyCashes.map((x) => x.id === tempId ? dailyCash : x) }))),
      () => set((s) => ({ dailyCashes: s.dailyCashes.filter((x) => x.id !== tempId) }))
    );
  },
  closeDailyCash: (id, closingBalance, notes) => {
    set((s) => ({ dailyCashes: s.dailyCashes.map((dc) => dc.id === id ? { ...dc, closingBalance, closed: true, ...(notes !== undefined ? { notes } : {}) } : dc) }));
    sync(() => authFetch(`/api/daily-cash/${id}/close`, { method: 'PUT', body: JSON.stringify({ closingBalance, notes }) }).then(() => {}));
  },
  addCashMovement: (m) => {
    const tempId = uid();
    set((s) => ({ cashMovements: [...s.cashMovements, { ...m, id: tempId, createdAt: now() }] }));
    sync(
      () => authFetch('/api/daily-cash/movements', { method: 'POST', body: JSON.stringify(m) })
        .then((r) => r.json())
        .then(({ movement }) => set((s) => ({ cashMovements: s.cashMovements.map((x) => x.id === tempId ? movement : x) }))),
      () => set((s) => ({ cashMovements: s.cashMovements.filter((x) => x.id !== tempId) }))
    );
  },
  deleteCashMovement: (id) => {
    const prev = get().cashMovements;
    set((s) => ({ cashMovements: s.cashMovements.filter((m) => m.id !== id) }));
    sync(
      () => authFetch(`/api/daily-cash/movements/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ cashMovements: prev })
    );
  },

  // ── Tax Payments ───────────────────────────────────────────────────────
  addTaxPayment: (t) => {
    const tempId = uid();
    set((s) => ({ taxPayments: [...s.taxPayments, { ...t, id: tempId, createdAt: now() }] }));
    sync(
      () => authFetch('/api/tax-payments', { method: 'POST', body: JSON.stringify(t) })
        .then((r) => r.json())
        .then(({ taxPayment }) => set((s) => ({ taxPayments: s.taxPayments.map((x) => x.id === tempId ? taxPayment : x) }))),
      () => set((s) => ({ taxPayments: s.taxPayments.filter((x) => x.id !== tempId) }))
    );
  },
  updateTaxPayment: (id, data) => {
    set((s) => ({ taxPayments: s.taxPayments.map((t) => t.id === id ? { ...t, ...data } : t) }));
    sync(() => authFetch(`/api/tax-payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(() => {}));
  },
  deleteTaxPayment: (id) => {
    const prev = get().taxPayments;
    set((s) => ({ taxPayments: s.taxPayments.filter((t) => t.id !== id) }));
    sync(
      () => authFetch(`/api/tax-payments/${id}`, { method: 'DELETE' }).then(() => {}),
      () => set({ taxPayments: prev })
    );
  },
  markTaxPaid: (id) => {
    set((s) => ({ taxPayments: s.taxPayments.map((t) => t.id === id ? { ...t, paid: true, paidDate: today() } : t) }));
    sync(() => authFetch(`/api/tax-payments/${id}/pay`, { method: 'PUT' }).then(() => {}));
  },
}));
