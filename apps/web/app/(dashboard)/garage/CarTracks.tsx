import { formatLapTime, slugToName } from "@/lib/format";

interface TrackEntry {
  track_id: string;
  name: string;
  best_lap_ms: number | null;
  sessions: number;
}

interface Props {
  tracks: TrackEntry[];
}

export function CarTracks({ tracks }: Props) {
  if (tracks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nenhuma pista registrada para este carro.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {tracks.map((track) => (
        <div key={track.track_id} className="bg-muted/40 border border-border rounded-lg p-3">
          <p className="text-xs font-semibold text-foreground truncate mb-1">
            {slugToName(track.track_id)}
          </p>
          {track.best_lap_ms && (
            <p className="text-sm font-bold font-mono text-primary">
              {formatLapTime(track.best_lap_ms)}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            {track.sessions} {track.sessions === 1 ? "sessão" : "sessões"}
          </p>
        </div>
      ))}
    </div>
  );
}
