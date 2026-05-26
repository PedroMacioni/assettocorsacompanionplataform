"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, slugToName } from "@/lib/format";
import type { CarSetup } from "@/lib/types";

// ─── Tipos de display ────────────────────────────────────────────────────────

type DisplayType = "bar" | "value" | "percent" | "progress" | "text";

interface FieldDef {
  label: string;
  unit: string;
  display: DisplayType;
  max?: number;
  segments?: number;
  transform?: (v: number) => number;
}

// ─── Configuração dos campos ─────────────────────────────────────────────────

const FIELDS: Record<string, FieldDef> = {
  // Aero
  WING_1:              { label: "Asa dianteira",      unit: "",       display: "bar",      max: 10,  segments: 11 },
  WING_2:              { label: "Asa traseira",        unit: "",       display: "bar",      max: 10,  segments: 11 },
  WING_3:              { label: "Asa 3",               unit: "",       display: "bar",      max: 10,  segments: 11 },
  WING_9:              { label: "DRS",                 unit: "",       display: "bar",      max: 1,   segments: 2  },
  // ARB
  ARB_FRONT:           { label: "ARB dianteiro",       unit: "",       display: "bar",      max: 10,  segments: 11 },
  ARB_REAR:            { label: "ARB traseiro",        unit: "",       display: "bar",      max: 10,  segments: 11 },
  // Ride height
  RIDE_HEIGHT_F:       { label: "Altura diant.",       unit: " mm",    display: "value" },
  RIDE_HEIGHT_R:       { label: "Altura tras.",        unit: " mm",    display: "value" },
  // Molas
  SPRING_LF:           { label: "Mola F.Esq",          unit: " N/mm",  display: "value" },
  SPRING_RF:           { label: "Mola F.Dir",          unit: " N/mm",  display: "value" },
  SPRING_LR:           { label: "Mola T.Esq",          unit: " N/mm",  display: "value" },
  SPRING_RR:           { label: "Mola T.Dir",          unit: " N/mm",  display: "value" },
  SPRING_RATE_LF:      { label: "Mola F.Esq",          unit: "",       display: "value" },
  SPRING_RATE_RF:      { label: "Mola F.Dir",          unit: "",       display: "value" },
  SPRING_RATE_LR:      { label: "Mola T.Esq",          unit: "",       display: "value" },
  SPRING_RATE_RR:      { label: "Mola T.Dir",          unit: "",       display: "value" },
  // Bump / Rebound
  BUMP_LF:             { label: "Bump F.Esq",          unit: "",       display: "value" },
  BUMP_RF:             { label: "Bump F.Dir",          unit: "",       display: "value" },
  BUMP_LR:             { label: "Bump T.Esq",          unit: "",       display: "value" },
  BUMP_RR:             { label: "Bump T.Dir",          unit: "",       display: "value" },
  REBOUND_LF:          { label: "Rebound F.Esq",       unit: "",       display: "value" },
  REBOUND_RF:          { label: "Rebound F.Dir",       unit: "",       display: "value" },
  REBOUND_LR:          { label: "Rebound T.Esq",       unit: "",       display: "value" },
  REBOUND_RR:          { label: "Rebound T.Dir",       unit: "",       display: "value" },
  DAMP_BUMP_LF:        { label: "Bump F.Esq",          unit: "",       display: "value" },
  DAMP_BUMP_RF:        { label: "Bump F.Dir",          unit: "",       display: "value" },
  DAMP_BUMP_LR:        { label: "Bump T.Esq",          unit: "",       display: "value" },
  DAMP_BUMP_RR:        { label: "Bump T.Dir",          unit: "",       display: "value" },
  DAMP_REBOUND_LF:     { label: "Rebound F.Esq",       unit: "",       display: "value" },
  DAMP_REBOUND_RF:     { label: "Rebound F.Dir",       unit: "",       display: "value" },
  DAMP_REBOUND_LR:     { label: "Rebound T.Esq",       unit: "",       display: "value" },
  DAMP_REBOUND_RR:     { label: "Rebound T.Dir",       unit: "",       display: "value" },
  // High-speed dampers (F1 / GT3)
  DAMP_BUMP_HF:        { label: "Bump alt. diant.",    unit: "",       display: "value" },
  DAMP_BUMP_HR:        { label: "Bump alt. tras.",     unit: "",       display: "value" },
  DAMP_REBOUND_HF:     { label: "Reb. alt. diant.",    unit: "",       display: "value" },
  DAMP_REBOUND_HR:     { label: "Reb. alt. tras.",     unit: "",       display: "value" },
  // Geometria
  CAMBER_LF:           { label: "Camber F.Esq",        unit: "°",      display: "value" },
  CAMBER_RF:           { label: "Camber F.Dir",        unit: "°",      display: "value" },
  CAMBER_LR:           { label: "Camber T.Esq",        unit: "°",      display: "value" },
  CAMBER_RR:           { label: "Camber T.Dir",        unit: "°",      display: "value" },
  TOE_LF:              { label: "Toe F.Esq",           unit: "°",      display: "value" },
  TOE_RF:              { label: "Toe F.Dir",           unit: "°",      display: "value" },
  TOE_LR:              { label: "Toe T.Esq",           unit: "°",      display: "value" },
  TOE_RR:              { label: "Toe T.Dir",           unit: "°",      display: "value" },
  TOE_OUT_LF:          { label: "Toe F.Esq",           unit: "°",      display: "value" },
  TOE_OUT_RF:          { label: "Toe F.Dir",           unit: "°",      display: "value" },
  TOE_OUT_LR:          { label: "Toe T.Esq",           unit: "°",      display: "value" },
  TOE_OUT_RR:          { label: "Toe T.Dir",           unit: "°",      display: "value" },
  // Rod length (F1)
  ROD_LENGTH_LF:       { label: "Rod F.Esq",           unit: " mm",    display: "value" },
  ROD_LENGTH_RF:       { label: "Rod F.Dir",           unit: " mm",    display: "value" },
  ROD_LENGTH_LR:       { label: "Rod T.Esq",           unit: " mm",    display: "value" },
  ROD_LENGTH_RR:       { label: "Rod T.Dir",           unit: " mm",    display: "value" },
  // Pressão
  PRESSURE_LF:         { label: "Pressão F.Esq",       unit: " psi",   display: "progress", max: 40, segments: 10 },
  PRESSURE_RF:         { label: "Pressão F.Dir",       unit: " psi",   display: "progress", max: 40, segments: 10 },
  PRESSURE_LR:         { label: "Pressão T.Esq",       unit: " psi",   display: "progress", max: 40, segments: 10 },
  PRESSURE_RR:         { label: "Pressão T.Dir",       unit: " psi",   display: "progress", max: 40, segments: 10 },
  // Tração
  BRAKE:               { label: "Frenagem",             unit: "%",      display: "percent",  max: 1,   transform: (v) => Math.round(v * 100) },
  FRONT_BIAS:          { label: "Bias de freio",        unit: "%",      display: "percent",  max: 100 },
  DIFF_POWER:          { label: "Diff. aceleração",    unit: "%",      display: "percent",  max: 100 },
  DIFF_COAST:          { label: "Diff. desacel.",      unit: "%",      display: "percent",  max: 100 },
  DIFF_PRELOAD:        { label: "Diff. preload",       unit: " Nm",    display: "value" },
  // Eletrônico — carros de estrada
  ABS:                 { label: "ABS",                  unit: "",       display: "bar",      max: 10,  segments: 11 },
  TRACTION_CONTROL:    { label: "Controle de tração",   unit: "",       display: "bar",      max: 10,  segments: 11 },
  TRACTION_CONTROL_2:  { label: "TC2",                  unit: "",       display: "bar",      max: 10,  segments: 11 },
  ENGINE_BRAKE:        { label: "Freio motor",          unit: "",       display: "bar",      max: 10,  segments: 11 },
  BRAKE_MAGIC:         { label: "Brake magic",          unit: "",       display: "bar",      max: 10,  segments: 11 },
  // Eletrônico — F1 / protótipos
  BRAKE_ENGINE:        { label: "Freio motor",          unit: "",       display: "bar",      max: 10,  segments: 11 },
  STEER_ASSIST:        { label: "Assist. direção",      unit: "",       display: "bar",      max: 100, segments: 10 },
  MGUH_MODE:           { label: "MGU-H",                unit: "",       display: "bar",      max: 4,   segments: 5  },
  MGUK_DELIVERY:       { label: "MGU-K deploy.",        unit: "",       display: "bar",      max: 7,   segments: 8  },
  MGUK_RECOVERY:       { label: "MGU-K recup.",         unit: "",       display: "bar",      max: 10,  segments: 11 },
  // Misc
  FUEL:                { label: "Combustível",          unit: " L",     display: "progress", max: 120, segments: 12 },
  BALLAST:             { label: "Lastro",              unit: " kg",    display: "value" },
};

// ─── Grupos consolidados ─────────────────────────────────────────────────────

type LayoutType = "bars" | "values-grid" | "corners" | "misc" | "mixed";

interface GroupDef {
  id: string;
  label: string;
  layout: LayoutType;
  keys: string[];
}

const GROUPS: GroupDef[] = [
  {
    id: "elec", label: "Eletrônico", layout: "bars",
    keys: ["ABS", "TRACTION_CONTROL", "TRACTION_CONTROL_2", "ENGINE_BRAKE", "BRAKE_MAGIC",
           "BRAKE_ENGINE", "STEER_ASSIST", "MGUH_MODE", "MGUK_DELIVERY", "MGUK_RECOVERY"],
  },
  {
    id: "aero", label: "Aero", layout: "bars",
    keys: ["WING_1", "WING_2", "WING_3", "WING_9"],
  },
  {
    id: "susp", label: "Suspensão", layout: "mixed",
    keys: [
      "ARB_FRONT", "ARB_REAR",
      "RIDE_HEIGHT_F", "RIDE_HEIGHT_R",
      "DAMP_BUMP_HF", "DAMP_BUMP_HR", "DAMP_REBOUND_HF", "DAMP_REBOUND_HR",
      "SPRING_LF",      "SPRING_RF",      "SPRING_LR",      "SPRING_RR",
      "SPRING_RATE_LF", "SPRING_RATE_RF", "SPRING_RATE_LR", "SPRING_RATE_RR",
      "BUMP_LF",        "BUMP_RF",        "BUMP_LR",        "BUMP_RR",
      "REBOUND_LF",     "REBOUND_RF",     "REBOUND_LR",     "REBOUND_RR",
      "DAMP_BUMP_LF",   "DAMP_BUMP_RF",   "DAMP_BUMP_LR",   "DAMP_BUMP_RR",
      "DAMP_REBOUND_LF","DAMP_REBOUND_RF","DAMP_REBOUND_LR","DAMP_REBOUND_RR",
    ],
  },
  {
    id: "wheels", label: "Rodas", layout: "corners",
    keys: [
      "CAMBER_LF",     "CAMBER_RF",     "CAMBER_LR",     "CAMBER_RR",
      "TOE_LF",        "TOE_RF",        "TOE_LR",        "TOE_RR",
      "TOE_OUT_LF",    "TOE_OUT_RF",    "TOE_OUT_LR",    "TOE_OUT_RR",
      "ROD_LENGTH_LF", "ROD_LENGTH_RF", "ROD_LENGTH_LR", "ROD_LENGTH_RR",
      "PRESSURE_LF",   "PRESSURE_RF",   "PRESSURE_LR",   "PRESSURE_RR",
    ],
  },
  {
    id: "drive", label: "Tração", layout: "misc",
    keys: ["BRAKE", "FRONT_BIAS", "DIFF_POWER", "DIFF_COAST", "DIFF_PRELOAD", "FUEL", "BALLAST"],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CORNER_RE = /_(LF|RF|LR|RR)$/;

function getRaw(data: CarSetup["data"], section: string): number | string | null {
  const sec = data[section];
  if (!sec) return null;
  const v = sec.VALUE ?? sec.BIAS ?? sec.VALUE_1 ?? sec.COMPOUND ?? sec.NAME;
  if (typeof v === "number" || typeof v === "string") return v;
  return null;
}

function fmtVal(raw: number, def: FieldDef): string {
  const v = def.transform ? def.transform(raw) : raw;
  return `${v}${def.unit}`;
}

function downloadSetup(setup: CarSetup) {
  const lines: string[] = [];
  for (const [section, values] of Object.entries(setup.data)) {
    lines.push(`[${section}]`);
    for (const [k, v] of Object.entries(values)) {
      if (v !== undefined && v !== null) lines.push(`${k}=${v}`);
    }
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `${setup.name}.ini`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Primitivos visuais ───────────────────────────────────────────────────────

function SegBar({ filled, total }: { filled: number; total: number }) {
  return (
    <div className="flex gap-[3px] mt-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={cn("h-[4px] flex-1 rounded-[2px]", i < filled ? "bg-primary" : "bg-muted")} />
      ))}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="mt-1.5 h-[4px] w-full rounded-[2px] bg-muted overflow-hidden">
      <div className="h-full rounded-[2px] bg-primary/80 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-muted-foreground py-1">Sem dados para esta categoria.</p>;
}

// ─── Layouts ─────────────────────────────────────────────────────────────────

function BarsLayout({ keys, data }: { keys: string[]; data: CarSetup["data"] }) {
  const rows = keys.flatMap((key) => {
    const def = FIELDS[key]; if (!def) return [];
    const raw = getRaw(data, key);
    if (typeof raw !== "number") return [];
    const display = fmtVal(raw, def);
    const filled  = Math.min(def.segments ?? 10, Math.round((raw / (def.max ?? 10)) * (def.segments ?? 10)));
    return [{ key, label: def.label, display, filled, segments: def.segments ?? 10 }];
  });
  if (rows.length === 0) return <Empty />;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-5">
      {rows.map(({ key, label, display, filled, segments }) => (
        <div key={key}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-bold font-mono text-foreground shrink-0">{display}</p>
          </div>
          <SegBar filled={filled} total={segments} />
        </div>
      ))}
    </div>
  );
}

function ValuesGrid({ keys, data }: { keys: string[]; data: CarSetup["data"] }) {
  const rows = keys.flatMap((key) => {
    const def = FIELDS[key]; if (!def) return [];
    const raw = getRaw(data, key);
    if (raw === null) return [];
    const isNum  = typeof raw === "number";
    const display = isNum ? fmtVal(raw, def) : `${raw}`;
    const pct    = (def.display === "percent" && isNum)
      ? Math.min(100, Math.round(((def.transform ? def.transform(raw) : raw) / (def.max ?? 100)) * 100))
      : null;
    const prog   = (def.display === "progress" && isNum) ? { v: raw, max: def.max ?? 100 } : null;
    return [{ key, label: def.label, display, pct, prog }];
  });
  if (rows.length === 0) return <Empty />;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      {rows.map(({ key, label, display, pct, prog }) => (
        <div key={key}>
          <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
          <p className="text-sm font-bold font-mono text-foreground">{display}</p>
          {pct !== null && <ProgressBar value={pct} max={100} />}
          {prog !== null && <ProgressBar value={prog.v} max={prog.max} />}
        </div>
      ))}
    </div>
  );
}

interface CornerGroup { name: string; lf: string; rf: string; lr?: string; rr?: string }

function buildCornerGroups(keys: string[], data: CarSetup["data"]): CornerGroup[] {
  const found: Record<string, { lf?: number; rf?: number; lr?: number; rr?: number; unit: string }> = {};
  for (const key of keys) {
    const def = FIELDS[key]; if (!def) continue;
    const raw = getRaw(data, key);
    if (typeof raw !== "number") continue;
    const match = key.match(/^(.+?)_(LF|RF|LR|RR)$/);
    if (!match) continue;
    const base   = match[1];
    const corner = match[2] as "LF" | "RF" | "LR" | "RR";
    if (!found[base]) found[base] = { unit: def.unit };
    found[base][corner.toLowerCase() as "lf" | "rf" | "lr" | "rr"] = def.transform ? def.transform(raw) : raw;
  }
  return Object.entries(found).map(([base, vals]) => {
    const def  = FIELDS[`${base}_LF`];
    const name = def?.label.replace(/ F\.Esq| F\.Dir| T\.Esq| T\.Dir/g, "").trim() ?? base;
    return {
      name,
      lf: vals.lf !== undefined ? `${vals.lf}${vals.unit}` : "—",
      rf: vals.rf !== undefined ? `${vals.rf}${vals.unit}` : "—",
      lr: vals.lr !== undefined ? `${vals.lr}${vals.unit}` : undefined,
      rr: vals.rr !== undefined ? `${vals.rr}${vals.unit}` : undefined,
    };
  });
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 text-center">
      <p className="text-[9px] text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-bold font-mono text-foreground">{value}</p>
    </div>
  );
}

function CornersLayout({ keys, data }: { keys: string[]; data: CarSetup["data"] }) {
  const groups = buildCornerGroups(keys, data);
  if (groups.length === 0) return <Empty />;
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.name}>
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{g.name}</p>
          <div className="grid grid-cols-2 gap-1.5">
            <Cell label="Diant. Esq" value={g.lf} />
            <Cell label="Diant. Dir" value={g.rf} />
            {(g.lr !== undefined || g.rr !== undefined) && (
              <>
                <Cell label="Tras. Esq" value={g.lr ?? "—"} />
                <Cell label="Tras. Dir" value={g.rr ?? "—"} />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Layout misto para Suspensão: barras (ARB) + valores gerais + cantos
function MixedLayout({ keys, data }: { keys: string[]; data: CarSetup["data"] }) {
  const cornerKeys = keys.filter((k) => CORNER_RE.test(k));
  const otherKeys  = keys.filter((k) => !CORNER_RE.test(k));
  const barKeys    = otherKeys.filter((k) => FIELDS[k]?.display === "bar"  && getRaw(data, k) !== null);
  const valKeys    = otherKeys.filter((k) => FIELDS[k]?.display !== "bar"  && getRaw(data, k) !== null);
  const corners    = buildCornerGroups(cornerKeys, data);

  const hasBars    = barKeys.length > 0;
  const hasVals    = valKeys.length > 0;
  const hasCorners = corners.length > 0;

  if (!hasBars && !hasVals && !hasCorners) return <Empty />;

  return (
    <div className="space-y-5">
      {hasBars && <BarsLayout keys={barKeys} data={data} />}
      {hasVals && (
        <div className={cn(hasBars && "pt-5 border-t border-border/50")}>
          <ValuesGrid keys={valKeys} data={data} />
        </div>
      )}
      {hasCorners && (
        <div className={cn((hasBars || hasVals) && "pt-5 border-t border-border/50")}>
          <CornersLayout keys={cornerKeys} data={data} />
        </div>
      )}
    </div>
  );
}

// Layout Tração/Misc: valores com barra de progresso para cada um
function DriveLayout({ keys, data }: { keys: string[]; data: CarSetup["data"] }) {
  const rows = keys.flatMap((key) => {
    const def = FIELDS[key]; if (!def) return [];
    const raw = getRaw(data, key);
    if (raw === null) return [];
    const isNum   = typeof raw === "number";
    const transformed = (isNum && def.transform) ? def.transform(raw as number) : raw;
    const display = `${transformed}${def.unit}`;
    const pct = (def.display === "percent" && isNum)
      ? Math.min(100, Math.round((transformed as number) / (def.max ?? 100) * 100))
      : (def.display === "progress" && isNum)
      ? Math.min(100, Math.round((raw as number) / (def.max ?? 100) * 100))
      : null;
    return [{ key, label: def.label, display, pct }];
  });
  if (rows.length === 0) return <Empty />;
  return (
    <div className="space-y-4">
      {rows.map(({ key, label, display, pct }) => (
        <div key={key}>
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-bold font-mono text-foreground">{display}</p>
          </div>
          {pct !== null && <ProgressBar value={pct} max={100} />}
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function SetupDetailPanel({ setup }: { setup: CarSetup }) {
  const knownKeys = new Set(Object.keys(FIELDS));

  const activeGroups = GROUPS.map((g) => ({
    ...g,
    hasData: g.keys.some((k) => getRaw(setup.data, k) !== null),
  })).filter((g) => g.hasData);

  const otherEntries = Object.entries(setup.data)
    .filter(([section]) => !knownKeys.has(section))
    .flatMap(([section, values]) =>
      Object.entries(values)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => ({ label: `${section} · ${k}`, display: String(v) }))
    );

  const tabs = [
    ...activeGroups.map((g) => ({ id: g.id, label: g.label })),
    ...(otherEntries.length > 0 ? [{ id: "other", label: "Outros" }] : []),
  ];

  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  if (tabs.length === 0) {
    return <p className="text-sm text-muted-foreground py-2">Nenhum campo reconhecido neste setup.</p>;
  }

  const group = GROUPS.find((g) => g.id === activeTab);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground leading-tight truncate">
            {slugToName(setup.track_id)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {setup.name} · editado {formatDate(setup.updated_at)}
          </p>
        </div>
        <button
          onClick={() => downloadSetup(setup)}
          title="Baixar setup como .ini"
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border bg-muted text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Abas underline */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative shrink-0 px-3 py-2 text-[11px] font-medium transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="min-h-[120px]">
        {activeTab === "other" ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {otherEntries.map(({ label, display }) => (
              <div key={label}>
                <p className="text-[10px] text-muted-foreground truncate">{label}</p>
                <p className="text-sm font-bold font-mono text-foreground mt-0.5">{display}</p>
              </div>
            ))}
          </div>
        ) : group?.layout === "bars"        ? <BarsLayout    keys={group.keys} data={setup.data} />
          : group?.layout === "mixed"       ? <MixedLayout   keys={group.keys} data={setup.data} />
          : group?.layout === "corners"     ? <CornersLayout keys={group.keys} data={setup.data} />
          : group?.layout === "misc"        ? <DriveLayout   keys={group.keys} data={setup.data} />
          : group                           ? <ValuesGrid    keys={group.keys} data={setup.data} />
          : null}
      </div>
    </div>
  );
}
