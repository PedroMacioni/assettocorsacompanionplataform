import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LapTime } from "@/components/LapTime";
import { slugToName } from "@/lib/format";
import type { PersonalBest } from "@/lib/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function PersonalBestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("personal_bests")
    .select("*")
    .eq("user_id", user!.id)
    .order("time_ms", { ascending: true });

  const bests = (data ?? []) as PersonalBest[];

  if (bests.length === 0) return <EmptyState title="Nenhum personal best sincronizado ainda" />;

  const fastestMs = bests[0].time_ms;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Personal Bests</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Carro</TableHead>
            <TableHead>Pista</TableHead>
            <TableHead className="text-right">Melhor Tempo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bests.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-medium">{slugToName(b.car_id)}</TableCell>
              <TableCell>{slugToName(b.track_id)}</TableCell>
              <TableCell className="text-right">
                <span className="font-mono"><LapTime ms={b.time_ms} /></span>
                {b.time_ms === fastestMs && (
                  <Badge className="ml-2" variant="default">Record</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
