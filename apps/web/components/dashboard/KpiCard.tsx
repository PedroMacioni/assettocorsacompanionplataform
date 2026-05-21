type Props = {
  label: string;
  value: string | number;
  sub?: string;
  subVariant?: "positive" | "negative" | "neutral";
};

export function KpiCard({ label, value, sub, subVariant = "neutral" }: Props) {
  const subColor =
    subVariant === "positive" ? "text-green-500" :
    subVariant === "negative" ? "text-destructive" :
    "text-muted-foreground";

  return (
    <div className="bg-card border border-border rounded-md p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{label}</p>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {sub && <p className={`text-xs mt-1.5 ${subColor}`}>{sub}</p>}
    </div>
  );
}
