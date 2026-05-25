import type { CarSpecs as CarSpecsType } from "@/lib/types";

interface Props {
  specs: CarSpecsType | null;
}

export function CarSpecs({ specs }: Props) {
  if (!specs) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Especificações não disponíveis. Aguardando sincronização do agente.
      </p>
    );
  }

  const pwRatio =
    specs.bhp && specs.weight
      ? Math.round((specs.bhp * 1000) / specs.weight)
      : null;

  const items = [
    { label: "Potência", value: specs.bhp ? `${specs.bhp} hp` : null },
    { label: "Peso", value: specs.weight ? `${specs.weight} kg` : null },
    { label: "0–100", value: specs.acceleration ? `${(specs.acceleration / 10).toFixed(1)} s` : null },
    { label: "Top Speed", value: specs.top_speed ? `${specs.top_speed} km/h` : null },
    { label: "Drivetrain", value: specs.drivetrain ?? null },
    { label: "Rel. P/W", value: pwRatio ? `${pwRatio} hp/t` : null },
    { label: "Torque", value: specs.torque ? `${specs.torque} Nm` : null },
  ].filter((i) => i.value);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bg-muted/40 border border-border rounded-lg p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            {item.label}
          </p>
          <p className="text-sm font-bold text-foreground font-mono">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
