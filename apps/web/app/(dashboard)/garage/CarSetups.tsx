"use client";

import { useState } from "react";
import { formatLapTime, formatDate, slugToName } from "@/lib/format";
import { SetupDetails } from "./SetupDetails";
import type { CarSetup } from "@/lib/types";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  setups: CarSetup[];
}

export function CarSetups({ setups }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (setups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Nenhum setup importado. Configure o agente para sincronizar seus setups.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {setups.map((setup) => {
        const expanded = expandedId === setup.id;
        const trackLabel = slugToName(setup.track_id).slice(0, 2).toUpperCase();

        return (
          <div key={setup.id} className="border border-border rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : setup.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
            >
              <span className="shrink-0 w-7 h-7 rounded-md bg-muted border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {trackLabel}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {slugToName(setup.track_id)} · {setup.name}
                  </p>
                  {setup.is_active && (
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      Ativo
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Atualizado: {formatDate(setup.updated_at)}
                </p>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {setup.best_lap_ms && (
                  <span className="text-xs font-mono font-semibold text-foreground">
                    {formatLapTime(setup.best_lap_ms)}
                  </span>
                )}
                {expanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
            </button>

            {expanded && (
              <div className="px-4 pb-4">
                <SetupDetails setup={setup} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
