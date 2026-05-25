import { cn } from "@/lib/utils";
import { formatDate, slugToName } from "@/lib/format";
import type { CarSetup } from "@/lib/types";

interface Props {
  setup: CarSetup;
}

interface FieldConfig {
  label: string;
  unit: string;
  max: number;
  segments: number;
  transform?: (v: number) => number;
}

const FIELD_CONFIG: Record<string, FieldConfig> = {
  WING_1:       { label: "Front wing",      unit: "",       max: 10,  segments: 11 },
  WING_2:       { label: "Rear wing",       unit: "",       max: 10,  segments: 11 },
  ARB_FRONT:    { label: "Front ARB",       unit: "",       max: 10,  segments: 11 },
  ARB_REAR:     { label: "Rear ARB",        unit: "",       max: 10,  segments: 11 },
  RIDE_HEIGHT_F:{ label: "Ride height F/R", unit: "",       max: 10,  segments: 11 },
  RIDE_HEIGHT_R:{ label: "Ride height R",   unit: "",       max: 10,  segments: 11 },
  FUEL:         { label: "Fuel",            unit: " L",     max: 120, segments: 12 },
  PRESSURE_LF:  { label: "Tire F left",     unit: " psi",   max: 40,  segments: 10 },
  PRESSURE_RF:  { label: "Tire F right",    unit: " psi",   max: 40,  segments: 10 },
  PRESSURE_LR:  { label: "Tire R left",     unit: " psi",   max: 40,  segments: 10 },
  PRESSURE_RR:  { label: "Tire R right",    unit: " psi",   max: 40,  segments: 10 },
  BRAKE:        { label: "Brake bias",      unit: "%",      max: 1,   segments: 10, transform: (v) => Math.round(v * 100) },
  DIFF_POWER:   { label: "Differential",    unit: " lock%", max: 100, segments: 10 },
  DIFF_COAST:   { label: "Diff coast",      unit: " lock%", max: 100, segments: 10 },
};

const DISPLAY_ORDER = [
  "WING_1", "WING_2", "BRAKE",
  "PRESSURE_LF", "PRESSURE_RF", "DIFF_POWER",
  "ARB_FRONT", "ARB_REAR", "RIDE_HEIGHT_F",
  "FUEL", "PRESSURE_LR", "PRESSURE_RR",
];

function getRaw(data: CarSetup["data"], section: string): number | null {
  const sec = data[section];
  if (!sec) return null;
  const v = sec.VALUE ?? sec.BIAS ?? sec.VALUE_1;
  return typeof v === "number" ? v : null;
}

function SegmentedBar({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex gap-[3px] mt-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            "h-[3px] flex-1 rounded-[1px]",
            i < filled ? "bg-primary" : "bg-muted"
          )}
        />
      ))}
    </div>
  );
}

export function SetupDetailPanel({ setup }: Props) {
  const rows: { key: string; label: string; display: string; filled: number; segments: number }[] = [];

  for (const key of DISPLAY_ORDER) {
    const cfg = FIELD_CONFIG[key];
    if (!cfg) continue;
    const raw = getRaw(setup.data, key);
    if (raw === null) continue;

    const displayVal = cfg.transform ? cfg.transform(raw) : raw;
    const isSlider = cfg.max === 10; // x/11 style
    const display = isSlider
      ? `${displayVal} / ${cfg.segments - 1}`
      : `${displayVal}${cfg.unit}`;

    const filled = Math.round((raw / cfg.max) * cfg.segments);
    rows.push({ key, label: cfg.label, display, filled, segments: cfg.segments });
  }

  return (
    <div className="space-y-3">
      {/* header */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          SETUP · {slugToName(setup.track_id).toUpperCase()} {setup.name.toUpperCase()}
        </p>
        <p className="text-[9px] text-muted-foreground">
          Last edited {formatDate(setup.updated_at)}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          Nenhum campo reconhecido neste setup.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-x-5 gap-y-4">
          {rows.map(({ key, label, display, filled, segments }) => (
            <div key={key}>
              <div className="flex items-baseline justify-between gap-1">
                <p className="text-[10px] text-muted-foreground truncate">{label}</p>
                <p className="text-xs font-bold font-mono text-foreground shrink-0">{display}</p>
              </div>
              <SegmentedBar filled={filled} total={segments} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
