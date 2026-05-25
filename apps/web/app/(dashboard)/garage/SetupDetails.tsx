import { formatLapTime, formatDate } from "@/lib/format";
import type { CarSetup } from "@/lib/types";

interface Props {
  setup: CarSetup;
}

const DISPLAY_KEYS: { key: string; label: string; format?: (v: number) => string }[] = [
  { key: "WING_1", label: "Front wing" },
  { key: "WING_2", label: "Rear wing" },
  { key: "BRAKE", label: "Brake bias", format: (v) => `${Math.round(v * 100)}%` },
  { key: "FUEL", label: "Combustível", format: (v) => `${v} L` },
  { key: "PRESSURE_LF", label: "Pneu F Esq.", format: (v) => `${v} psi` },
  { key: "PRESSURE_RF", label: "Pneu F Dir.", format: (v) => `${v} psi` },
  { key: "PRESSURE_LR", label: "Pneu T Esq.", format: (v) => `${v} psi` },
  { key: "PRESSURE_RR", label: "Pneu T Dir.", format: (v) => `${v} psi` },
  { key: "ARB_FRONT", label: "ARB Dianteiro" },
  { key: "ARB_REAR", label: "ARB Traseiro" },
];

function getValue(data: CarSetup["data"], sectionKey: string): number | null {
  const section = data[sectionKey];
  if (!section) return null;
  const val = section.VALUE ?? section.BIAS;
  return typeof val === "number" ? val : null;
}

export function SetupDetails({ setup }: Props) {
  const rows = DISPLAY_KEYS
    .map(({ key, label, format }) => {
      const val = getValue(setup.data, key);
      if (val === null) return null;
      return { label, value: format ? format(val) : String(val) };
    })
    .filter(Boolean) as { label: string; value: string }[];

  const extraKeys = Object.keys(setup.data).filter(
    (k) => !DISPLAY_KEYS.some((d) => d.key === k)
  );

  return (
    <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Setup · {setup.name}
        </p>
        <p className="text-[10px] text-muted-foreground">
          Editado: {formatDate(setup.updated_at)}
        </p>
      </div>

      {setup.best_lap_ms && (
        <p className="text-xs text-muted-foreground">
          Melhor volta:{" "}
          <span className="font-mono font-bold text-primary">
            {formatLapTime(setup.best_lap_ms)}
          </span>
        </p>
      )}

      {rows.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className="text-xs font-mono font-semibold text-foreground">{r.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum dado de setup reconhecido.</p>
      )}

      {extraKeys.length > 0 && (
        <details className="group">
          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground select-none">
            +{extraKeys.length} campos adicionais
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {extraKeys.map((k) => {
              const val = getValue(setup.data, k);
              return val !== null ? (
                <div key={k} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate">{k}</span>
                  <span className="text-xs font-mono font-semibold text-foreground">{val}</span>
                </div>
              ) : null;
            })}
          </div>
        </details>
      )}
    </div>
  );
}
