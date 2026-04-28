import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'empleado' CHECK(role IN ('admin', 'empleado')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    year INTEGER NOT NULL DEFAULT 0,
    km INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '',
    patent TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'comprado',
    purchase_price REAL NOT NULL DEFAULT 0,
    publish_price REAL NOT NULL DEFAULT 0,
    sold_price REAL,
    usd_price REAL,
    purchase_date TEXT NOT NULL DEFAULT '',
    sold_date TEXT,
    sold_to_client_id TEXT,
    sale_id TEXT,
    trade_in_vehicle_id TEXT,
    checklist TEXT NOT NULL DEFAULT '{"lavado":false,"pulido":false,"mecanica":false,"papeles":false}',
    documents TEXT NOT NULL DEFAULT '{"titulo":false,"cedulaVerde":false,"cedulaAzul":false,"vtv":false,"libreDeuda":false,"verificacionPolicial":false,"seguro":false}',
    images TEXT NOT NULL DEFAULT '[]',
    publish_links TEXT NOT NULL DEFAULT '[]',
    price_history TEXT NOT NULL DEFAULT '[]',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    dni TEXT NOT NULL DEFAULT '',
    cuit TEXT,
    phone TEXT NOT NULL DEFAULT '',
    phone2 TEXT,
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    province TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    client_id TEXT NOT NULL,
    sale_date TEXT NOT NULL,
    sale_price REAL NOT NULL DEFAULT 0,
    payment_type TEXT NOT NULL DEFAULT 'contado',
    down_payment REAL NOT NULL DEFAULT 0,
    installments INTEGER NOT NULL DEFAULT 0,
    installment_amount REAL NOT NULL DEFAULT 0,
    invoice_number TEXT,
    trade_in_vehicle_id TEXT,
    trade_in_value REAL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS installment_payments (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    installment_number INTEGER NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    paid INTEGER NOT NULL DEFAULT 0,
    paid_date TEXT
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'otro',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    cuit TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    date TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'otro',
    vehicle_id TEXT,
    supplier_id TEXT,
    paid INTEGER NOT NULL DEFAULT 0,
    paid_date TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fixed_expense_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'otro',
    default_amount REAL NOT NULL DEFAULT 0,
    due_day INTEGER NOT NULL DEFAULT 10,
    recurring INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fixed_expense_records (
    id TEXT PRIMARY KEY,
    type_id TEXT NOT NULL DEFAULT '',
    type_name TEXT NOT NULL DEFAULT '',
    month TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT '',
    paid INTEGER NOT NULL DEFAULT 0,
    paid_date TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pendiente',
    priority TEXT NOT NULL DEFAULT 'media',
    vehicle_id TEXT,
    client_id TEXT,
    supplier_id TEXT,
    due_date TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'ingreso',
    category TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL DEFAULT '',
    vehicle_id TEXT,
    client_id TEXT,
    supplier_id TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transfers (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL DEFAULT '',
    client_id TEXT,
    gestor_id TEXT,
    status TEXT NOT NULL DEFAULT 'pendiente',
    verificacion_policial INTEGER NOT NULL DEFAULT 0,
    verificacion_fecha TEXT,
    informe_dominio INTEGER NOT NULL DEFAULT 0,
    informe_dominio_fecha TEXT,
    formulario_08_firmado INTEGER NOT NULL DEFAULT 0,
    titulo_entregado INTEGER NOT NULL DEFAULT 0,
    cedula_entregada INTEGER NOT NULL DEFAULT 0,
    fecha_estimada_entrega TEXT,
    fecha_completado TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT,
    vehicle_id TEXT,
    source TEXT NOT NULL DEFAULT 'otro',
    status TEXT NOT NULL DEFAULT 'consulta',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contact_history (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS daily_cashes (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    opening_balance REAL NOT NULL DEFAULT 0,
    closing_balance REAL,
    closed INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cash_movements (
    id TEXT PRIMARY KEY,
    daily_cash_id TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'ingreso',
    amount REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tax_payments (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'otro',
    description TEXT NOT NULL DEFAULT '',
    month TEXT NOT NULL DEFAULT '',
    amount REAL NOT NULL DEFAULT 0,
    due_date TEXT NOT NULL DEFAULT '',
    paid INTEGER NOT NULL DEFAULT 0,
    paid_date TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_campaigns (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL DEFAULT '',
    emisor TEXT NOT NULL DEFAULT '',
    modelo TEXT NOT NULL DEFAULT '',
    vigencia_desde TEXT NOT NULL DEFAULT '',
    vigencia_hasta TEXT NOT NULL DEFAULT '',
    planes TEXT NOT NULL DEFAULT '[]',
    condiciones_generales TEXT NOT NULL DEFAULT '[]',
    seguro TEXT NOT NULL DEFAULT '',
    identificacion_sistema TEXT NOT NULL DEFAULT '[]',
    notas TEXT NOT NULL DEFAULT '',
    explicacion TEXT NOT NULL DEFAULT '',
    raw_result TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cheques (
    id TEXT PRIMARY KEY,
    numero TEXT NOT NULL DEFAULT '',
    banco TEXT NOT NULL DEFAULT '',
    monto REAL NOT NULL DEFAULT 0,
    moneda TEXT NOT NULL DEFAULT 'ARS',
    fecha_emision TEXT NOT NULL DEFAULT '',
    fecha_vencimiento TEXT NOT NULL DEFAULT '',
    tipo TEXT NOT NULL DEFAULT 'al_dia',
    al_portador INTEGER NOT NULL DEFAULT 0,
    endosado INTEGER NOT NULL DEFAULT 0,
    librador TEXT NOT NULL DEFAULT '',
    cuit_librador TEXT NOT NULL DEFAULT '',
    recibido_de TEXT NOT NULL DEFAULT '',
    entregado_a TEXT NOT NULL DEFAULT '',
    estado TEXT NOT NULL DEFAULT 'en_cartera',
    observaciones TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

`);

// Migrations for existing DBs
try { db.exec(`ALTER TABLE credit_campaigns ADD COLUMN explicacion TEXT NOT NULL DEFAULT ''`); } catch {}

// Sync infrastructure
db.exec(`
  CREATE TABLE IF NOT EXISTS sync_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Tables that participate in cloud sync
export const SYNCABLE_TABLES = [
  'vehicles', 'clients', 'sales', 'installment_payments',
  'suppliers', 'expenses', 'tasks', 'transactions',
  'transfers', 'leads', 'contact_history', 'daily_cashes', 'cash_movements',
  'fixed_expense_types', 'fixed_expense_records', 'tax_payments',
  'credit_campaigns', 'cheques',
];

// Add updated_at column and auto-update triggers to every sync table
for (const t of SYNCABLE_TABLES) {
  try { db.exec(`ALTER TABLE ${t} ADD COLUMN updated_at TEXT`); } catch {}
  try { db.exec(`UPDATE ${t} SET updated_at = created_at WHERE updated_at IS NULL`); } catch {}
  try {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_${t}_insert
      AFTER INSERT ON ${t}
      BEGIN
        UPDATE ${t} SET updated_at = datetime('now') WHERE id = NEW.id AND updated_at IS NULL;
      END;

      CREATE TRIGGER IF NOT EXISTS trg_${t}_update
      AFTER UPDATE ON ${t}
      WHEN OLD.updated_at = NEW.updated_at OR NEW.updated_at IS NULL
      BEGIN
        UPDATE ${t} SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
  } catch {}
}

export default db;
