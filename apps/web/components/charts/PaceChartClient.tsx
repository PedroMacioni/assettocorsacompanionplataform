"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

const PaceLineChart = dynamic(() => import("@/components/charts/PaceLineChart"), {
  ssr: false,
  loading: () => <div className="h-[280px] bg-control rounded-md animate-pulse" />,
});

type DataPoint = Record<string, string | number | null>;

type Props = {
  data: DataPoint[];
  tracks: string[];
  trackLabels: Record<string, string>;
};

export function PaceChartClient({ data, tracks, trackLabels }: Props) {
  const t = useTranslations("PaceChart");

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex flex-col items-center justify-center text-center gap-2 px-6">
        <p className="text-muted-foreground text-sm font-medium">{t("noData")}</p>
        <p className="text-muted-foreground text-xs max-w-xs">{t("noDataHint")}</p>
      </div>
    );
  }

  return <PaceLineChart data={data} tracks={tracks} trackLabels={trackLabels} />;
}
