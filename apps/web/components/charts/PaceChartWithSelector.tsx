"use client";

import { useState } from "react";
import { PaceChartClient } from "./PaceChartClient";

type DataPoint = Record<string, string | number | null>;

type Props = {
  data: DataPoint[];
  tracks: string[];
  trackLabels: Record<string, string>;
};

export function PaceChartWithSelector({ data, tracks, trackLabels }: Props) {
  const [selectedTrack, setSelectedTrack] = useState<string>("all");

  const filteredTracks = selectedTrack === "all" ? tracks : [selectedTrack];
  const filteredData =
    selectedTrack === "all"
      ? data
      : data
          .map((d) => {
            const point: DataPoint = { date: d.date };
            if (d[selectedTrack] !== undefined) point[selectedTrack] = d[selectedTrack];
            return point;
          })
          .filter((d) => Object.keys(d).length > 1);

  return (
    <div>
      {tracks.length > 1 && (
        <div className="flex justify-end mb-3">
          <select
            value={selectedTrack}
            onChange={(e) => setSelectedTrack(e.target.value)}
            className="text-xs bg-[#1e1e20] border border-[#2a2a2c] rounded px-2 py-1.5 text-[#6b6b72] focus:outline-none focus:border-[#e8612a] transition-colors"
          >
            <option value="all">Todas as pistas</option>
            {tracks.map((trackId) => (
              <option key={trackId} value={trackId}>
                {trackLabels[trackId] ?? trackId}
              </option>
            ))}
          </select>
        </div>
      )}
      <PaceChartClient data={filteredData} tracks={filteredTracks} trackLabels={trackLabels} />
    </div>
  );
}
