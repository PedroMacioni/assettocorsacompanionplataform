import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { LapTime } from "@/components/LapTime";
import { slugToName } from "@/lib/format";
import { getPersonalBests } from "@/lib/queries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Loading skeleton
function PersonalBestsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-muted rounded w-1/4" />
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}

export default async function PersonalBestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const uid = user!.id;

  return (
    <Suspense fallback={<PersonalBestsSkeleton />}>
      <PersonalBestsContent userId={uid} />
    </Suspense>
  );
}

async function PersonalBestsContent({ userId }: { userId: string }) {
  const bests = await getPersonalBests(userId);

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
