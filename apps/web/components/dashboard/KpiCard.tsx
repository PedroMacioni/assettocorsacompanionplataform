type Props = {
  label: string;
  value: string | number;
  sub?: string;
  subVariant?: "positive" | "negative" | "neutral";
};

export function KpiCard({ label, value, sub, subVariant = "neutral" }: Props) {
  const subColor =
    subVariant === "positive" ? "text-[#22c55e]" :
    subVariant === "negative" ? "text-[#ef4444]" :
    "text-[#6b6b72]";

  return (
    <div className="bg-[#161618] border border-[#2a2a2c] rounded-md p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6b6b72] mb-2">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className={`text-xs mt-1.5 ${subColor}`}>{sub}</p>}
    </div>
  );
}
