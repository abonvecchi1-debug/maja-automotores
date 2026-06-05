import type { TradeInInput, Vehicle } from '../types';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { vehicleLabel } from '../utils/formatters';

/** Estado del formulario de "auto en parte de pago" dentro de un modal de venta. */
export type TradeInState = {
  mode: 'none' | 'nuevo' | 'existente';
  value: number;
  vehicleId: string;
  brand: string;
  model: string;
  year: number;
  patent: string;
  km: number;
  color: string;
};

export const EMPTY_TRADEIN: TradeInState = {
  mode: 'none', value: 0, vehicleId: '',
  brand: '', model: '', year: new Date().getFullYear(), patent: '', km: 0, color: '',
};

/** Convierte el estado del formulario a lo que espera el backend (o undefined si no aplica). */
export function toTradeInInput(t: TradeInState): TradeInInput | undefined {
  if (t.mode === 'none' || !t.value) return undefined;
  if (t.mode === 'existente') {
    return t.vehicleId ? { type: 'existing', value: t.value, vehicleId: t.vehicleId } : undefined;
  }
  return {
    type: 'new', value: t.value,
    brand: t.brand, model: t.model, year: t.year, patent: t.patent, km: t.km, color: t.color,
  };
}

export function TradeInSection({
  value, onChange, vehicles,
}: {
  value: TradeInState;
  onChange: (t: TradeInState) => void;
  vehicles: Vehicle[];
}) {
  const set = (patch: Partial<TradeInState>) => onChange({ ...value, ...patch });

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-slate-700">Auto en parte de pago (opcional)</p>
      <div className="flex gap-2">
        {([['none', 'No recibo'], ['nuevo', 'Recibo uno nuevo'], ['existente', 'Uno que ya tengo']] as const).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => set({ mode: m })}
            className={`flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-colors ${
              value.mode === m ? 'bg-brand-50 border-brand-400 text-brand-700' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {value.mode === 'nuevo' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Marca" value={value.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="Ej: Volkswagen" />
            <Input label="Modelo" value={value.model} onChange={(e) => set({ model: e.target.value })} placeholder="Ej: Gol Trend" />
            <Input label="Año" type="number" value={value.year} onChange={(e) => set({ year: +e.target.value })} />
            <Input label="Patente" value={value.patent} onChange={(e) => set({ patent: e.target.value })} placeholder="AB123CD" />
            <Input label="Km" type="number" value={value.km} onChange={(e) => set({ km: +e.target.value })} />
            <Input label="Color" value={value.color} onChange={(e) => set({ color: e.target.value })} />
          </div>
          <Input label="Valor que le asignás ($)" type="number" value={value.value} onChange={(e) => set({ value: +e.target.value })} />
          <p className="text-[11px] text-slate-400">
            Se carga solo en tu stock con este valor como costo. Así, cuando lo vendas, la ganancia de ese auto sale exacta.
          </p>
        </div>
      )}

      {value.mode === 'existente' && (
        <div className="space-y-3">
          <Select
            label="Vehículo que recibís"
            value={value.vehicleId}
            onChange={(e) => set({ vehicleId: e.target.value })}
            options={vehicles.filter((v) => v.status !== 'vendido').map((v) => ({
              value: v.id, label: `${vehicleLabel(v.brand, v.model, v.year)} — ${v.patent}`,
            }))}
            placeholder="Seleccionar vehículo"
          />
          <Input label="Valor que le asignás ($)" type="number" value={value.value} onChange={(e) => set({ value: +e.target.value })} />
        </div>
      )}
    </div>
  );
}
