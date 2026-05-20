"use client";

import dynamic from "next/dynamic";

const PaceLineChart = dynamic(() => import("@/components/charts/PaceLineChart"), {
  ssr: false,
  loading: () => <div className="h-[200px] bg-[#1e1e20] rounded-md animate-pulse" />,
});

type DataPoint = Record<string, string | number | null>;

type Props = {
  data: DataPoint[];
  tracks: string[];
  trackLabels: Record<string, string>;
};

export function PaceChartClient({ data, tracks, trackLabels }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-[#6b6b72] text-sm">
        No lap data for the last 4 weeks
      </div>
    );
  }
  return <PaceLineChart data={data} tracks={tracks} trackLabels={trackLabels} />;
}
