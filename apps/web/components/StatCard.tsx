import { Card, CardContent } from "@/components/ui/card";

type Props = { label: string; value: string | number; sub?: string };

export function StatCard({ label, value, sub }: Props) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
